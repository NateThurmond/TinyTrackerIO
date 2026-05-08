'use client'

import { useState } from 'react'
import type { Feeding, Diaper, Sleep } from '@/lib/supabase/types'
import { formatAmount, formatTime, getDurationMinutes, formatDuration } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  tab: 'feeding' | 'diaper' | 'sleep'
  date: string
  babyId: string
  unit: 'ml' | 'oz'
  feedings: Feeding[]
  diapers: Diaper[]
  sleeps: Sleep[]
}

const SIZE_EMOJI: Record<string, string> = { small: '🟡', med: '🟠', big: '🔴', ginormous: '💥' }

export default function HistoryClient({ tab: initialTab, date: initialDate, unit, feedings, diapers, sleeps }: Props) {
  const [tab, setTab] = useState(initialTab)
  const [date, setDate] = useState(initialDate)

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

  return (
    <div className="min-h-screen bg-rose-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bold text-gray-800 flex-1">History</h1>
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
      </div>

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
    </div>
  )
}
