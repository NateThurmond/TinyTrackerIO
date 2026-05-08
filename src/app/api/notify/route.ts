import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '@/lib/supabase/types'

const supabaseAdmin = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { babyId, loggedByUserId, title, body } = await req.json() as {
    babyId: string
    loggedByUserId: string
    title: string
    body: string
  }

  if (!babyId || !title) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Get all caregivers for this baby except the one who logged
  const { data: caregivers } = await supabaseAdmin
    .from('baby_caregivers')
    .select('user_id')
    .eq('baby_id', babyId)
    .neq('user_id', loggedByUserId)

  if (!caregivers || caregivers.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const recipientIds = caregivers.map((c) => c.user_id)

  // Get push subscriptions for those users that have notifications enabled
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipientIds)
    .eq('enabled', true)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  webpush.setVapidDetails(
    'mailto:noreply@tinytrackerio.nathanthurmond.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify({ title, body, url: '/' })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length

  // Clean up expired subscriptions (410 Gone)
  const expired = subs.filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && (r as PromiseRejectedResult).reason?.statusCode === 410
  })
  if (expired.length > 0) {
    await Promise.all(
      expired.map((sub) =>
        supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      )
    )
  }

  return NextResponse.json({ sent })
}
