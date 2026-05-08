'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Sleep } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function EditSleepClient({ sleep }: { sleep: Sleep }) {
  const router = useRouter()
  const supabase = createClient()

  const [startedAt, setStartedAt] = useState(new Date(sleep.started_at).toISOString().slice(0, 16))
  const [endedAt, setEndedAt] = useState(sleep.ended_at ? new Date(sleep.ended_at).toISOString().slice(0, 16) : '')
  const [notes, setNotes] = useState(sleep.notes ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    await supabase.from('sleeps').update({
      started_at: new Date(startedAt).toISOString(),
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', sleep.id)
    setLoading(false)
    router.push('/history?tab=sleep')
  }

  async function handleDelete() {
    if (!confirm('Delete this sleep entry?')) return
    await supabase.from('sleeps').delete().eq('id', sleep.id)
    router.push('/history?tab=sleep')
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/history?tab=sleep" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-gray-800 flex-1">Edit Sleep</h1>
        <button onClick={handleDelete} className="text-red-400 hover:text-red-600 p-1">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sleep started</label>
            <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Woke up (leave blank if ongoing)</label>
            <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              placeholder="Optional notes" />
          </div>
          <button onClick={handleSave} disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
