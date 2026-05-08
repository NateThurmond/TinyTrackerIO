'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Alarm } from '@/lib/supabase/types'
import { ArrowLeft, Plus, Trash2, Bell, BellOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ALARM_TYPES = [
  { value: 'feeding', label: 'Feeding', emoji: '🍼' },
  { value: 'diaper', label: 'Diaper check', emoji: '💩' },
  { value: 'sleep', label: 'Sleep reminder', emoji: '😴' },
  { value: 'custom', label: 'Custom', emoji: '⏰' },
] as const

type AlarmType = 'feeding' | 'diaper' | 'sleep' | 'custom'

export default function AlarmsClient({ babyId, userId, alarms: initialAlarms }: {
  babyId: string
  userId: string
  alarms: Alarm[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [alarms, setAlarms] = useState(initialAlarms)
  const [showForm, setShowForm] = useState(false)

  // New alarm form
  const [type, setType] = useState<AlarmType>('feeding')
  const [label, setLabel] = useState('')
  const [intervalHours, setIntervalHours] = useState('3')
  const [intervalMins, setIntervalMins] = useState('0')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    setSaving(true)
    const totalMins = parseInt(intervalHours) * 60 + parseInt(intervalMins)
    const nextDue = new Date(Date.now() + totalMins * 60000).toISOString()
    const defaultLabel = label || ALARM_TYPES.find(t => t.value === type)?.label || type
    const { data } = await supabase.from('alarms').insert({
      baby_id: babyId,
      created_by: userId,
      type,
      label: defaultLabel,
      interval_minutes: totalMins > 0 ? totalMins : null,
      next_due_at: totalMins > 0 ? nextDue : null,
      enabled: true,
    }).select().single()
    if (data) setAlarms([data, ...alarms])
    setShowForm(false)
    setLabel('')
    setSaving(false)
  }

  async function toggleAlarm(alarm: Alarm) {
    await supabase.from('alarms').update({ enabled: !alarm.enabled }).eq('id', alarm.id)
    setAlarms(alarms.map(a => a.id === alarm.id ? { ...a, enabled: !a.enabled } : a))
  }

  async function deleteAlarm(id: string) {
    if (!confirm('Delete this alarm?')) return
    await supabase.from('alarms').delete().eq('id', id)
    setAlarms(alarms.filter(a => a.id !== id))
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-800"><ArrowLeft size={20} /></Link>
        <h1 className="font-bold text-gray-800 flex-1">Alarms & Reminders</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-rose-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-rose-600 transition">
          <Plus size={13} /> New
        </button>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-800">New Alarm</h2>
            <div className="grid grid-cols-2 gap-2">
              {ALARM_TYPES.map((t) => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition
                    ${type === t.value ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-gray-200 hover:border-rose-200'}`}>
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={`Label (default: ${ALARM_TYPES.find(t => t.value === type)?.label})`}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Repeat every</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="0" max="23" value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <span className="text-sm text-gray-500">hours</span>
                <input type="number" min="0" max="59" step="15" value={intervalMins} onChange={(e) => setIntervalMins(e.target.value)}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <span className="text-sm text-gray-500">min</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium rounded-xl py-2.5 hover:bg-gray-50 transition text-sm">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-2.5 transition disabled:opacity-50 text-sm">
                {saving ? 'Saving…' : 'Create Alarm'}
              </button>
            </div>
          </div>
        )}

        {alarms.length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-400">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p>No alarms set yet</p>
            <p className="text-xs mt-1">Tap New to add a reminder</p>
          </div>
        ) : (
          alarms.map((alarm) => (
            <div key={alarm.id} className={`bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 ${!alarm.enabled && 'opacity-50'}`}>
              <span className="text-xl">{ALARM_TYPES.find(t => t.value === alarm.type)?.emoji ?? '⏰'}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-800 text-sm">{alarm.label}</p>
                {alarm.interval_minutes && (
                  <p className="text-xs text-gray-400">
                    Every {alarm.interval_minutes >= 60
                      ? `${Math.floor(alarm.interval_minutes / 60)}h ${alarm.interval_minutes % 60 > 0 ? `${alarm.interval_minutes % 60}m` : ''}`
                      : `${alarm.interval_minutes}m`}
                    {alarm.next_due_at && ` · Next: ${new Date(alarm.next_due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  </p>
                )}
              </div>
              <button onClick={() => toggleAlarm(alarm)} className="text-gray-400 hover:text-gray-700 p-1">
                {alarm.enabled ? <Bell size={18} className="text-rose-400" /> : <BellOff size={18} />}
              </button>
              <button onClick={() => deleteAlarm(alarm.id)} className="text-gray-300 hover:text-red-400 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
