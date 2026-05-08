'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Diaper } from '@/lib/supabase/types'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

type DiaperType = 'pee' | 'poop' | 'mixed'
type DiaperSize = 'small' | 'med' | 'big' | 'ginormous'

const SIZE_EMOJI: Record<DiaperSize, string> = { small: '🟡', med: '🟠', big: '🔴', ginormous: '💥' }

export default function EditDiaperClient({ diaper }: { diaper: Diaper }) {
  const router = useRouter()
  const supabase = createClient()

  const [type, setType] = useState<DiaperType>(diaper.type)
  const [size, setSize] = useState<DiaperSize | null>(diaper.size ?? null)
  const [notes, setNotes] = useState(diaper.notes ?? '')
  const [changedAt, setChangedAt] = useState(new Date(diaper.changed_at).toISOString().slice(0, 16))
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    await supabase.from('diapers').update({
      type, size, notes: notes || null,
      changed_at: new Date(changedAt).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', diaper.id)
    setLoading(false)
    router.push('/history?tab=diaper')
  }

  async function handleDelete() {
    await supabase.from('diapers').delete().eq('id', diaper.id)
    router.push('/history?tab=diaper')
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/history?tab=diaper" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-gray-800 flex-1">Edit Diaper</h1>
        <button onClick={handleDelete} className="text-red-400 hover:text-red-600 p-1">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {(['pee', 'poop', 'mixed'] as DiaperType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition capitalize
                    ${type === t ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-amber-200'}`}>
                  {t === 'pee' ? '💧 Pee' : t === 'poop' ? '💩 Poop' : '💩+💧 Mixed'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
            <div className="flex gap-2">
              {(['small', 'med', 'big', 'ginormous'] as DiaperSize[]).map((s) => (
                <button key={s} onClick={() => setSize(s)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium transition capitalize
                    ${size === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-amber-200'}`}>
                  {SIZE_EMOJI[s]} {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input type="datetime-local" value={changedAt} onChange={(e) => setChangedAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              placeholder="Optional notes" />
          </div>
          <button onClick={handleSave} disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
