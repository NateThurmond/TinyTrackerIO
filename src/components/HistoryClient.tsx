'use client'

import { useState, useEffect } from 'react'
import type { Feeding, Diaper, Sleep } from '@/lib/supabase/types'
import { formatAmount, formatTime, getDurationMinutes, formatDuration } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, BarChart2, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

interface Props {
  tab: 'feeding' | 'diaper' | 'sleep'
  date: string
  babyId: string
  unit: 'ml' | 'oz'
  feedings: Feeding[]
  diapers: Diaper[]
  sleeps: Sleep[]
}

type TrendDay = {
  label: string
  feedingMl: number
  poops: number
  pees: number
  sleepMin: number
}

const SIZE_EMOJI: Record<string, string> = { small: '🟡', med: '🟠', big: '🔴', ginormous: '💥' }

const RANGE_OPTIONS = [7, 14, 30] as const
type RangeOption = typeof RANGE_OPTIONS[number]

export default function HistoryClient({ tab: initialTab, date: initialDate, unit, feedings, diapers, sleeps, babyId }: Props) {
  const [tab, setTab] = useState(initialTab)
  const [date, setDate] = useState(initialDate)
  const [mode, setMode] = useState<'list' | 'chart'>('chart')
  const [range, setRange] = useState<RangeOption>(14)
  const [trendData, setTrendData] = useState<TrendDay[]>([])
  const [loadingTrend, setLoadingTrend] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (mode !== 'chart') return
    loadTrends()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, range])

  async function loadTrends() {
    setLoadingTrend(true)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date()
    start.setDate(start.getDate() - range + 1)
    start.setHours(0, 0, 0, 0)

    const [f, d, s] = await Promise.all([
      supabase.from('feedings').select('fed_at, amount_ml').eq('baby_id', babyId)
        .gte('fed_at', start.toISOString()).lte('fed_at', end.toISOString()),
      supabase.from('diapers').select('changed_at, type').eq('baby_id', babyId)
        .gte('changed_at', start.toISOString()).lte('changed_at', end.toISOString()),
      supabase.from('sleeps').select('started_at, ended_at').eq('baby_id', babyId)
        .gte('started_at', start.toISOString()).lte('started_at', end.toISOString()),
    ])

    const days: TrendDay[] = []
    for (let i = 0; i < range; i++) {
      const d2 = new Date(start)
      d2.setDate(d2.getDate() + i)
      const dayStart = new Date(d2); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d2); dayEnd.setHours(23, 59, 59, 999)

      const dayFeedings = (f.data ?? []).filter(x => {
        const t = new Date(x.fed_at)
        return t >= dayStart && t <= dayEnd
      })
      const dayDiapers = (d.data ?? []).filter(x => {
        const t = new Date(x.changed_at)
        return t >= dayStart && t <= dayEnd
      })
      const daySleeps = (s.data ?? []).filter(x => {
        const t = new Date(x.started_at)
        return t >= dayStart && t <= dayEnd
      })

      days.push({
        label: d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        feedingMl: dayFeedings.reduce((sum, x) => sum + x.amount_ml, 0),
        poops: dayDiapers.filter(x => x.type === 'poop' || x.type === 'mixed').length,
        pees: dayDiapers.filter(x => x.type === 'pee' || x.type === 'mixed').length,
        sleepMin: daySleeps.reduce((sum, x) => sum + getDurationMinutes(x.started_at, x.ended_at), 0),
      })
    }
    setTrendData(days)
    setLoadingTrend(false)
  }

  function shiftDate(days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    const newDate = d.toISOString().split('T')[0]
    setDate(newDate)
    window.location.href = `/history?tab=${tab}&date=${newDate}`
  }

  const isToday = date === new Date().toISOString().split('T')[0]

  const TABS = [
    { key: 'feeding', label: '🍼 Feeds' },
    { key: 'diaper', label: '💩 Diapers' },
    { key: 'sleep', label: '😴 Sleep' },
  ] as const

  const tickStyle = { fontSize: 10, fill: '#9ca3af' }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-gray-800 flex-1">History</h1>

        {/* Mode toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('chart')}
            className={`p-1.5 rounded-md transition ${mode === 'chart' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-400'}`}
          >
            <BarChart2 size={16} />
          </button>
          <button
            onClick={() => setMode('list')}
            className={`p-1.5 rounded-md transition ${mode === 'list' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-400'}`}
          >
            <List size={16} />
          </button>
        </div>

        {mode === 'list' && (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="p-1 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center">
              {isToday ? 'Today' : new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => shiftDate(1)} disabled={isToday} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Chart mode */}
      {mode === 'chart' && (
        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          {/* Range selector */}
          <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2.5 text-sm font-medium transition ${range === r ? 'bg-rose-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {r}d
              </button>
            ))}
          </div>

          {loadingTrend ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              {/* Feeding chart */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">🍼 Formula ({unit === 'oz' ? 'oz' : 'ml'} / day)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={tickStyle} interval={Math.floor(range / 7)} />
                    <YAxis tick={tickStyle} />
                    <Tooltip
                      formatter={(v: number) => unit === 'oz' ? [`${(v / 29.5735).toFixed(1)} oz`] : [`${v} ml`]}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="feedingMl" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Diaper chart */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">💩 Diapers / day</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={tickStyle} interval={Math.floor(range / 7)} />
                    <YAxis tick={tickStyle} allowDecimals={false} />
                    <Tooltip labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="poops" name="Poops" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="pees" name="Pees" fill="#fcd34d" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sleep chart */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">😴 Sleep (min / day)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={tickStyle} interval={Math.floor(range / 7)} />
                    <YAxis tick={tickStyle} />
                    <Tooltip
                      formatter={(v: number) => [formatDuration(v)]}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="sleepMin" stroke="#a855f7" strokeWidth={2} dot={false} name="Sleep" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* List mode */}
      {mode === 'list' && (
        <>
          {/* Tabs */}
          <div className="flex bg-white border-b border-gray-100 px-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                  tab === t.key ? 'border-rose-400 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
            {tab === 'feeding' && (
              <>
                <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-blue-600 font-medium">Total today</span>
                  <span className="text-lg font-bold text-blue-700">{formatAmount(feedings.reduce((s, f) => s + f.amount_ml, 0), unit)}</span>
                </div>
                {feedings.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No feedings on this day</p>
                ) : (
                  feedings.map((f) => (
                    <Link key={f.id} href={`/history/feeding/${f.id}`}
                      className="flex justify-between items-center bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition">
                      <div>
                        <span className="font-medium text-gray-800">{formatAmount(f.amount_ml, unit)}</span>
                        {f.notes && <p className="text-xs text-gray-400 mt-0.5">{f.notes}</p>}
                      </div>
                      <span className="text-sm text-gray-400">{formatTime(f.fed_at)}</span>
                    </Link>
                  ))
                )}
              </>
            )}

            {tab === 'diaper' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-yellow-50 rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{diapers.filter(d => d.type === 'pee' || d.type === 'mixed').length}</div>
                    <div className="text-xs text-yellow-500">💧 Pees</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{diapers.filter(d => d.type === 'poop' || d.type === 'mixed').length}</div>
                    <div className="text-xs text-amber-500">💩 Poops</div>
                  </div>
                </div>
                {diapers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No diaper changes on this day</p>
                ) : (
                  diapers.map((d) => (
                    <Link key={d.id} href={`/history/diaper/${d.id}`}
                      className="flex justify-between items-center bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-2">
                        <span>{d.type === 'pee' ? '💧' : d.type === 'poop' ? '💩' : '💩+💧'}</span>
                        <div>
                          <span className="font-medium text-gray-800 capitalize">{d.type}</span>
                          {d.size && <span className="text-sm text-gray-400 ml-1.5">{SIZE_EMOJI[d.size]} {d.size}</span>}
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">{formatTime(d.changed_at)}</span>
                    </Link>
                  ))
                )}
              </>
            )}

            {tab === 'sleep' && (
              <>
                <div className="bg-purple-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-purple-600 font-medium">Total sleep</span>
                  <span className="text-lg font-bold text-purple-700">
                    {formatDuration(sleeps.filter(s => s.ended_at).reduce((sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0)) || '—'}
                  </span>
                </div>
                {sleeps.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No sleep recorded on this day</p>
                ) : (
                  sleeps.map((s) => (
                    <Link key={s.id} href={`/history/sleep/${s.id}`}
                      className="flex justify-between items-center bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition">
                      <div>
                        <span className="font-medium text-gray-800">
                          {formatTime(s.started_at)} {s.ended_at ? `→ ${formatTime(s.ended_at)}` : '(ongoing)'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {s.ended_at ? formatDuration(getDurationMinutes(s.started_at, s.ended_at)) : '…'}
                      </span>
                    </Link>
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
