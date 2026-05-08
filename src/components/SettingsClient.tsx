'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'
import { ArrowLeft, Camera, Download, UserPlus, Trash2, Users, Bell, BellOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface Props {
  user: { id: string; email: string }
  profile: Profile
  baby: Record<string, unknown> | null
  role: 'owner' | 'caregiver'
  caregivers: Array<{ user_id: string; role: string; profiles: { display_name: string | null; email: string } | null }>
}

export default function SettingsClient({ user, profile, baby, role, caregivers }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [unit, setUnit] = useState<'ml' | 'oz'>(profile.unit_preference as 'ml' | 'oz')
  const [babyName, setBabyName] = useState((baby?.name as string) ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState((baby?.photo_url as string) ?? '')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Check if push is already subscribed for this device
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setPushSupported(true)
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setPushEnabled(!!sub)
      })
      .catch(() => {})
  }, [])

  async function handlePushToggle() {
    setPushLoading(true)
    try {
      if (!('serviceWorker' in navigator)) return
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
        await fetch('/api/push-subscription', { method: 'DELETE' })
        setPushEnabled(false)
      } else {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return
        }
        if (Notification.permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })
        const json = sub.toJSON()
        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: { endpoint: json.endpoint, keys: json.keys } }),
        })
        setPushEnabled(true)
      }
    } catch (e) {
      console.error('Push toggle failed', e)
    } finally {
      setPushLoading(false)
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const output = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
    return output
  }

  async function handleSave() {
    setSaving(true)
    await Promise.all([
      supabase.from('profiles').update({ display_name: displayName, unit_preference: unit, updated_at: new Date().toISOString() }).eq('id', user.id),
      baby ? supabase.from('babies').update({ name: babyName, updated_at: new Date().toISOString() }).eq('id', baby.id as string) : Promise.resolve(),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !baby) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${baby.id as string}/photo.${ext}`
    const { error } = await supabase.storage.from('baby-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('baby-photos').getPublicUrl(path)
      const url = data.publicUrl
      await supabase.from('babies').update({ photo_url: url }).eq('id', baby.id as string)
      setPhotoUrl(url)
    }
    setUploading(false)
  }

  async function handleInvite() {
    if (!baby || !inviteEmail.trim()) return
    setInviting(true)
    // Create invite record; in production you'd email the link
    const { data: invite } = await supabase.from('invites').insert({
      baby_id: baby.id as string,
      email: inviteEmail.trim(),
      created_by: user.id,
    }).select().single()
    if (invite) {
      const link = `${window.location.origin}/invite?token=${invite.token}`
      setInviteLink(link)
    }
    setInviteEmail('')
    setInviting(false)
  }

  async function handleExport(type: 'csv' | 'json') {
    if (!baby) return
    const [f, d, s] = await Promise.all([
      supabase.from('feedings').select('*').eq('baby_id', baby.id as string).order('fed_at', { ascending: true }),
      supabase.from('diapers').select('*').eq('baby_id', baby.id as string).order('changed_at', { ascending: true }),
      supabase.from('sleeps').select('*').eq('baby_id', baby.id as string).order('started_at', { ascending: true }),
    ])

    const allData = {
      feedings: f.data ?? [],
      diapers: d.data ?? [],
      sleeps: s.data ?? [],
    }

    let content: string
    let filename: string
    let mimeType: string

    if (type === 'json') {
      content = JSON.stringify(allData, null, 2)
      filename = `tinytracker-${babyName}-export.json`
      mimeType = 'application/json'
    } else {
      const rows: string[] = ['type,id,datetime,detail,notes']
      allData.feedings.forEach(f => rows.push(`feeding,${f.id},${f.fed_at},${f.amount_ml}ml,${f.notes ?? ''}`))
      allData.diapers.forEach(d => rows.push(`diaper,${d.id},${d.changed_at},${d.type} ${d.size ?? ''},${d.notes ?? ''}`))
      allData.sleeps.forEach(s => rows.push(`sleep,${s.id},${s.started_at},ended:${s.ended_at ?? 'ongoing'},${s.notes ?? ''}`))
      content = rows.join('\n')
      filename = `tinytracker-${babyName}-export.csv`
      mimeType = 'text/csv'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-800"><ArrowLeft size={20} /></Link>
        <h1 className="font-bold text-gray-800">Settings</h1>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Baby photo + name */}
        {baby && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-800">Baby Profile</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-rose-100 flex items-center justify-center flex-shrink-0">
                {photoUrl ? (
                  <Image src={photoUrl} alt="Baby photo" fill className="object-cover" />
                ) : (
                  <span className="text-3xl">👶</span>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition rounded-full"
                >
                  <Camera size={18} className="text-white" />
                </button>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Baby&apos;s name</label>
                <input type="text" value={babyName} onChange={(e) => setBabyName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
                {uploading && <p className="text-xs text-gray-400 mt-1">Uploading photo…</p>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        )}

        {/* Your account */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800">Your Account</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Display name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Your name" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Formula unit</label>
            <div className="flex gap-2">
              {(['ml', 'oz'] as const).map((u) => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition
                    ${unit === u ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-500 hover:border-rose-200'}`}>
                  {u}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Auto-converts for caregivers with different settings</p>
          </div>
          <p className="text-xs text-gray-400">Logged in as {user.email}</p>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-2.5 transition disabled:opacity-50 text-sm">
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* The Village */}
        {baby && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users size={16} className="text-rose-400" /> The Village
            </h2>
            <div className="space-y-2">
              {caregivers.length === 0 ? (
                <p className="text-sm text-gray-400">No caregivers yet</p>
              ) : (
                caregivers.map((c, idx) => (
                  <div key={c.user_id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-sm flex-shrink-0">
                      {(c.profiles?.display_name ?? c.profiles?.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">{c.profiles?.display_name ?? c.profiles?.email ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {c.user_id === user.id && c.role === 'owner'
                          ? 'Owner / Caregiver / Villiage Idiot #1'
                          : `🤝 Caregiver / Villiage Idiot #${idx + 1}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {role === 'owner' && (
              <>
                <div className="border-t border-gray-50 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Invite someone to the village</p>
                  <div className="flex gap-2">
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="partner@example.com"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
                    <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                      className="flex items-center gap-1 bg-rose-500 text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-rose-600 transition disabled:opacity-50">
                      <UserPlus size={15} /> Invite
                    </button>
                  </div>
                  {inviteLink && (
                    <div className="mt-2 bg-rose-50 rounded-xl p-3 space-y-2">
                      <p className="text-xs text-rose-700 font-medium">Share this link:</p>
                      <div className="flex gap-2 items-center">
                        <input
                          readOnly
                          value={inviteLink}
                          className="flex-1 text-xs bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-gray-700 select-all"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                          className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition whitespace-nowrap"
                        >
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Push Notifications */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Bell size={16} className="text-rose-400" /> Notifications
          </h2>
          {!pushSupported ? (
            <p className="text-sm text-gray-400">
              Push notifications require adding this app to your home screen first.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                Get notified when someone else in The Village logs a feeding, diaper change, or sleep.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {pushEnabled ? 'Notifications on' : 'Notifications off'}
                </span>
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
                    pushEnabled
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  {pushEnabled ? <><BellOff size={15} /> Turn off</> : <><Bell size={15} /> Turn on</>}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Export */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800">Export Data</h2>
          <p className="text-xs text-gray-400">Download all of {babyName || "your baby"}&apos;s tracking data</p>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')}
              className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => handleExport('json')}
              className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
              <Download size={14} /> JSON
            </button>
          </div>
        </div>

        {/* Alexa setup info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <h2 className="font-semibold text-gray-800">Alexa Integration</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your TinyTrackerIO Alexa Skill ID will be set up separately. Once deployed, you can say:
          </p>
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="text-xs font-mono text-gray-600">&quot;Alexa, tell TinyTracker add a poop&quot;</p>
            <p className="text-xs font-mono text-gray-600">&quot;Alexa, tell TinyTracker add a pee&quot;</p>
            <p className="text-xs font-mono text-gray-600">&quot;Alexa, tell TinyTracker add 210 ml&quot;</p>
          </div>
          <p className="text-xs text-gray-400">Alexa webhook URL: <span className="font-mono">/api/alexa</span></p>
        </div>
      </div>
    </div>
  )
}
