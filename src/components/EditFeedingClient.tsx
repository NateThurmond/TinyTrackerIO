'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Feeding } from '@/lib/supabase/types'
import { formatAmount, parseToMl, mlToOz } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function EditFeedingClient({ feeding, unit }: { feeding: Feeding; unit: 'ml' | 'oz' }) {
  const router = useRouter()
  const supabase = createClient()

  const displayValue = unit === 'oz' ? mlToOz(feeding.amount_ml) : feeding.amount_ml
  const [amount, setAmount] = useState(String(displayValue))
  const [notes, setNotes] = useState(feeding.notes ?? '')
  const [fedAt, setFedAt] = useState(new Date(feeding.fed_at).toISOString().slice(0, 16))
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setLoading(true)
    const ml = parseToMl(parseFloat(amount), unit)
    await supabase.from('feedings').update({
      amount_ml: ml,
      notes: notes || null,
      fed_at: new Date(fedAt).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', feeding.id)
    setLoading(false)
    router.push('/')
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('feedings').delete().eq('id', feeding.id)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-gray-800 flex-1">Edit Feeding</h1>
        <button onClick={handleDelete} disabled={deleting} className="text-red-400 hover:text-red-600 p-1">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({unit})</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-xl font-bold text-gray-400 w-10 text-center">{unit}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="datetime-local"
              value={fedAt}
              onChange={(e) => setFedAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Optional notes"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
