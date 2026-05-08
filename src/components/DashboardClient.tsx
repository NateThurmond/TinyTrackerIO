'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Baby, Profile, Feeding, Diaper, Sleep } from '@/lib/supabase/types'
import { formatAmount, parseToMl, mlToOz, formatTime, getDurationMinutes, formatDuration, getBabyAge } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { Settings, Clock, History, Bell, LogOut, Plus, Moon, Sun, Droplets, Camera } from 'lucide-react'

interface Props {
  user: { id: string; email: string }
  baby: Baby & { role: string }
  profile: Profile
  todayFeedings: Feeding[]
  todayDiapers: Diaper[]
  todaySleeps: Sleep[]
}

type DiaperType = 'pee' | 'poop' | 'mixed'
type DiaperSize = 'small' | 'med' | 'big' | 'ginormous'
type ActiveModal = 'feeding' | 'diaper' | 'sleep' | null

const DIAPER_SIZE_LABELS: DiaperSize[] = ['small', 'med', 'big', 'ginormous']
const DIAPER_SIZE_EMOJI: Record<DiaperSize, string> = {
  small: '🟡',
  med: '🟠',
  big: '🔴',
  ginormous: '💥',
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DashboardClient({ user, baby, profile, todayFeedings, todayDiapers, todaySleeps }: Props) {
  const supabase = createClient()
  const unit = profile.unit_preference as 'ml' | 'oz'

  const [feedings, setFeedings] = useState<Feeding[]>(todayFeedings)
  const [diapers, setDiapers] = useState<Diaper[]>(todayDiapers)
  const [sleeps, setSleeps] = useState<Sleep[]>(todaySleeps)

  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [submitting, setSubmitting] = useState(false)

  // Photo upload
  const photoRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string>((baby.photo_url as string) ?? '')
  const [photoUploading, setPhotoUploading] = useState(false)

  // Feeding form
  const [feedAmount, setFeedAmount] = useState('')

  // Diaper form
  const [diaperType, setDiaperType] = useState<DiaperType>('pee')
  const [diaperSize, setDiaperSize] = useState<DiaperSize>('med')

  // Sleep form
  const [sleepAction, setSleepAction] = useState<'start' | 'end'>('start')
  const activeSleep = sleeps.find((s) => !s.ended_at)

  // Timestamps (default to now, user can adjust before submitting)
  const [feedAt, setFeedAt] = useState('')
  const [changedAt, setChangedAt] = useState('')
  const [sleepStartAt, setSleepStartAt] = useState('')
  const [sleepEndAt, setSleepEndAt] = useState('')

  // Computed totals
  const totalMl = feedings.reduce((sum, f) => sum + f.amount_ml, 0)
  const peeCount = diapers.filter((d) => d.type === 'pee' || d.type === 'mixed').length
  const poopCount = diapers.filter((d) => d.type === 'poop' || d.type === 'mixed').length
  const totalSleepMin = sleeps.reduce((sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0)

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedings', filter: `baby_id=eq.${baby.id}` }, () => {
        refreshToday()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diapers', filter: `baby_id=eq.${baby.id}` }, () => {
        refreshToday()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sleeps', filter: `baby_id=eq.${baby.id}` }, () => {
        refreshToday()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baby.id])

  useEffect(() => {
    if (activeModal) {
      const now = toDatetimeLocal(new Date())
      setFeedAt(now)
      setChangedAt(now)
      setSleepStartAt(now)
      setSleepEndAt(now)
    }
  }, [activeModal])

  async function refreshToday() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()
    const [f, d, s] = await Promise.all([
      supabase.from('feedings').select('*').eq('baby_id', baby.id).gte('fed_at', todayISO).order('fed_at', { ascending: false }),
      supabase.from('diapers').select('*').eq('baby_id', baby.id).gte('changed_at', todayISO).order('changed_at', { ascending: false }),
      supabase.from('sleeps').select('*').eq('baby_id', baby.id).gte('started_at', todayISO).order('started_at', { ascending: false }),
    ])
    if (f.data) setFeedings(f.data)
    if (d.data) setDiapers(d.data)
    if (s.data) setSleeps(s.data)
  }

  async function logFeeding() {
    const amount = parseFloat(feedAmount)
    if (!amount || amount <= 0) return
    setSubmitting(true)
    const ml = parseToMl(amount, unit)
    await supabase.from('feedings').insert({ baby_id: baby.id, logged_by: user.id, amount_ml: ml, fed_at: new Date(feedAt).toISOString() })
    setFeedAmount('')
    setActiveModal(null)
    setSubmitting(false)
    await refreshToday()
  }

  async function logDiaper() {
    setSubmitting(true)
    await supabase.from('diapers').insert({
      baby_id: baby.id,
      logged_by: user.id,
      type: diaperType,
      size: diaperSize,
      changed_at: new Date(changedAt).toISOString(),
    })
    setActiveModal(null)
    setSubmitting(false)
    await refreshToday()
  }

  async function logSleep() {
    setSubmitting(true)
    if (sleepAction === 'start') {
      await supabase.from('sleeps').insert({ baby_id: baby.id, logged_by: user.id, started_at: new Date(sleepStartAt).toISOString() })
    } else if (activeSleep) {
      await supabase.from('sleeps').update({ ended_at: new Date(sleepEndAt).toISOString() }).eq('id', activeSleep.id)
    }
    setActiveModal(null)
    setSubmitting(false)
    await refreshToday()
  }

  function openSleepModal() {
    setSleepAction(activeSleep ? 'end' : 'start')
    setActiveModal('sleep')
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${baby.id}/photo.${ext}`
    const { error } = await supabase.storage.from('baby-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('baby-photos').getPublicUrl(path)
      await supabase.from('babies').update({ photo_url: data.publicUrl }).eq('id', baby.id as string)
      setPhotoUrl(data.publicUrl)
    }
    setPhotoUploading(false)
  }

  return (
    <div className="min-h-screen bg-rose-50">
      {/* ── HEADER ─────────────────────────────────────── */}
      <header className={`relative text-white overflow-hidden ${photoUrl ? 'bg-rose-700' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
        {photoUrl && (
          <>
            <Image
              src={photoUrl}
              alt={baby.name as string}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 z-[1]" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(190, 18, 60, 0.88) 100%)' }} />
          </>
        )}
        <div className="relative z-10 px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">{baby.name as string}</h1>
              {baby.birth_date && (
                <p className="text-rose-200 text-xs mt-0.5">{getBabyAge(baby.birth_date as string)}</p>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => photoRef.current?.click()}
                disabled={photoUploading}
                className="text-white/80 hover:text-white disabled:opacity-50"
                title="Change banner photo"
              >
                {photoUploading ? <span className="text-xs">…</span> : <Camera size={20} />}
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <Link href="/history" className="text-white/80 hover:text-white">
                <History size={20} />
              </Link>
              <Link href="/alarms" className="text-white/80 hover:text-white">
                <Bell size={20} />
              </Link>
              <Link href="/settings" className="text-white/80 hover:text-white">
                <Settings size={20} />
              </Link>
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <StatChip
              icon="🍼"
              label={formatAmount(totalMl, unit)}
              sub={`${feedings.length} feeds`}
            />
            <StatChip
              icon="💩"
              label={`${poopCount} poop${poopCount !== 1 ? 's' : ''}`}
              sub={`${peeCount} pee${peeCount !== 1 ? 's' : ''}`}
            />
            <StatChip
              icon="😴"
              label={totalSleepMin > 0 ? formatDuration(totalSleepMin) : '—'}
              sub={activeSleep ? 'Sleeping now' : `${sleeps.filter(s => s.ended_at).length} naps`}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────── */}
      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* FEEDING SECTION */}
        <Section
          title="Formula / Milk"
          emoji="🍼"
          color="blue"
          onAdd={() => setActiveModal('feeding')}
          addLabel="Log Feed"
        >
          {feedings.length === 0 ? (
            <EmptyState text="No feeds today yet" />
          ) : (
            feedings.slice(0, 5).map((f) => (
              <EntryRow
                key={f.id}
                left={formatTime(f.fed_at)}
                right={formatAmount(f.amount_ml, unit)}
                sub={f.notes ?? undefined}
                href={`/history/feeding/${f.id}`}
              />
            ))
          )}
          {feedings.length > 5 && (
            <Link href="/history?tab=feeding" className="block text-center text-xs text-blue-400 hover:underline pt-1">
              +{feedings.length - 5} more
            </Link>
          )}
        </Section>

        {/* DIAPER SECTION */}
        <Section
          title="Pee / Poop"
          emoji="💩"
          color="amber"
          onAdd={() => setActiveModal('diaper')}
          addLabel="Log Diaper"
        >
          {diapers.length === 0 ? (
            <EmptyState text="No diaper changes today" />
          ) : (
            diapers.slice(0, 5).map((d) => (
              <EntryRow
                key={d.id}
                left={formatTime(d.changed_at)}
                right={
                  <span className="flex items-center gap-1">
                    {d.type === 'pee' ? <Droplets size={13} className="text-yellow-400" /> : d.type === 'poop' ? '💩' : '💩+💧'}
                    <span className="capitalize">{d.type}</span>
                    {d.size && <span className="text-gray-400">· {d.size}</span>}
                  </span>
                }
                sub={d.notes ?? undefined}
                href={`/history/diaper/${d.id}`}
              />
            ))
          )}
          {diapers.length > 5 && (
            <Link href="/history?tab=diaper" className="block text-center text-xs text-amber-400 hover:underline pt-1">
              +{diapers.length - 5} more
            </Link>
          )}
        </Section>

        {/* SLEEP SECTION */}
        <Section
          title="Sleep"
          emoji="😴"
          color="purple"
          onAdd={openSleepModal}
          addLabel={activeSleep ? 'Wake Up' : 'Sleep Now'}
        >
          {activeSleep && (
            <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2 mb-2">
              <Moon size={14} className="text-purple-400" />
              <span className="text-sm text-purple-700 font-medium">Sleeping since {formatTime(activeSleep.started_at)}</span>
            </div>
          )}
          {sleeps.filter(s => s.ended_at).length === 0 && !activeSleep ? (
            <EmptyState text="No sleep recorded today" />
          ) : (
            sleeps
              .filter((s) => s.ended_at)
              .slice(0, 4)
              .map((s) => (
                <EntryRow
                  key={s.id}
                  left={`${formatTime(s.started_at)} – ${formatTime(s.ended_at!)}`}
                  right={formatDuration(getDurationMinutes(s.started_at, s.ended_at))}
                  href={`/history/sleep/${s.id}`}
                />
              ))
          )}
        </Section>

        {/* Sign out */}
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mx-auto py-2"
        >
          <LogOut size={13} /> Sign out
        </button>
      </main>

      {/* ── MODALS ─────────────────────────────────────── */}
      {activeModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {activeModal === 'feeding' && (
              <>
                <h2 className="text-lg font-bold text-gray-800">Log Formula / Milk</h2>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max={unit === 'ml' ? 400 : 15}
                    step={unit === 'ml' ? 5 : 0.5}
                    value={feedAmount}
                    onChange={(e) => setFeedAmount(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder={unit === 'ml' ? '120' : '4'}
                    autoFocus
                  />
                  <span className="text-2xl font-bold text-gray-400 w-10 text-center">{unit}</span>
                </div>
                {/* Quick amounts */}
                <div className="flex gap-2 flex-wrap">
                  {(unit === 'ml' ? [60, 90, 120, 150, 180, 210] : [2, 3, 4, 5, 6, 7]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFeedAmount(String(v))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition
                        ${feedAmount === String(v) ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">When?</label>
                  <input type="datetime-local" value={feedAt} onChange={(e) => setFeedAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <button
                  onClick={logFeeding}
                  disabled={submitting || !feedAmount}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Log Feed 🍼'}
                </button>
              </>
            )}

            {activeModal === 'diaper' && (
              <>
                <h2 className="text-lg font-bold text-gray-800">Log Diaper Change</h2>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Type</p>
                  <div className="flex gap-2">
                    {(['pee', 'poop', 'mixed'] as DiaperType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDiaperType(t)}
                        className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition capitalize
                          ${diaperType === t ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-amber-200'}`}
                      >
                        {t === 'pee' ? '💧 Pee' : t === 'poop' ? '💩 Poop' : '💩+💧 Mixed'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Size (optional)</p>
                  <div className="flex gap-2">
                    {DIAPER_SIZE_LABELS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setDiaperSize(s)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium transition capitalize
                          ${diaperSize === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-amber-200'}`}
                      >
                        {DIAPER_SIZE_EMOJI[s]} {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">When?</label>
                  <input type="datetime-local" value={changedAt} onChange={(e) => setChangedAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <button
                  onClick={logDiaper}
                  disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Log Diaper 💩'}
                </button>
              </>
            )}

            {activeModal === 'sleep' && (
              <>
                <h2 className="text-lg font-bold text-gray-800">
                  {sleepAction === 'start' ? 'Start Sleep' : 'End Sleep'}
                </h2>
                {sleepAction === 'start' ? (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Started at</label>
                    <input type="datetime-local" value={sleepStartAt} onChange={(e) => setSleepStartAt(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Started at {activeSleep ? formatTime(activeSleep.started_at) : '—'}</p>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Woke up at</label>
                      <input type="datetime-local" value={sleepEndAt} onChange={(e) => setSleepEndAt(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                  </div>
                )}
                <button
                  onClick={logSleep}
                  disabled={submitting}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : sleepAction === 'start' ? '😴 Baby is sleeping' : '☀️ Baby woke up'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function StatChip({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
      <div className="text-lg leading-none">{icon}</div>
      <div className="text-sm font-bold leading-tight mt-0.5">{label}</div>
      <div className="text-xs text-rose-200 leading-tight">{sub}</div>
    </div>
  )
}

function Section({
  title, emoji, color, onAdd, addLabel, children,
}: {
  title: string
  emoji: string
  color: 'blue' | 'amber' | 'purple'
  onAdd: () => void
  addLabel: string
  children: React.ReactNode
}) {
  const colorMap = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    amber: 'bg-amber-500 hover:bg-amber-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <h2 className="font-semibold text-gray-800 flex items-center gap-1.5">
          <span>{emoji}</span> {title}
        </h2>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition ${colorMap[color]}`}
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function EntryRow({
  left,
  right,
  sub,
  href,
}: {
  left: string
  right: React.ReactNode
  sub?: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-4 px-4 rounded-xl transition group">
      <div>
        <span className="text-sm text-gray-500">{left}</span>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{right}</span>
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-3">{text}</p>
}
