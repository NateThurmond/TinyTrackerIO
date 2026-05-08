'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function InviteContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'done'>('loading')
  const [babyName, setBabyName] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid invite link'); return }
    supabase.from('invites').select('*, babies(name)').eq('token', token).single()
      .then(({ data, error }) => {
        if (error || !data) { setStatus('error'); setMessage('Invite not found or expired'); return }
        if (data.accepted) { setStatus('error'); setMessage('This invite has already been used'); return }
        if (new Date(data.expires_at) < new Date()) { setStatus('error'); setMessage('This invite has expired'); return }
        setBabyName((data.babies as Record<string, unknown>)?.name as string ?? 'baby')
        setStatus('ready')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleAccept() {
    setStatus('loading')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/invite?token=${token}`); return }

    const { data: invite } = await supabase.from('invites').select('*').eq('token', token!).single()
    if (!invite) { setStatus('error'); setMessage('Invalid invite'); return }

    await Promise.all([
      supabase.from('baby_caregivers').insert({ baby_id: invite.baby_id, user_id: user.id, role: 'caregiver' }),
      supabase.from('invites').update({ accepted: true }).eq('id', invite.id),
    ])
    setStatus('done')
    setTimeout(() => router.push('/'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-100 to-rose-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">👶</div>
        {status === 'loading' && <p className="text-gray-500">Loading invite…</p>}
        {status === 'error' && (
          <div className="bg-red-50 text-red-600 rounded-2xl p-4">
            <p className="font-semibold">{message}</p>
          </div>
        )}
        {status === 'ready' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h1 className="text-xl font-bold text-gray-800">You&apos;re invited!</h1>
            <p className="text-gray-500 text-sm">You&apos;ve been invited to co-track <strong>{babyName}</strong> on TinyTrackerIO.</p>
            <button onClick={handleAccept}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl py-3 transition">
              Accept Invite 🎉
            </button>
          </div>
        )}
        {status === 'done' && (
          <div className="bg-green-50 text-green-600 rounded-2xl p-4">
            <p className="font-semibold">All set! Redirecting…</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}>
      <InviteContent />
    </Suspense>
  )
}
