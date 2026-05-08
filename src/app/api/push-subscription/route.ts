import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const supabaseAdmin = createSupabaseAdmin<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Save a push subscription for the current user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json() as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  }

  await supabaseAdmin
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      enabled: true,
    }, { onConflict: 'user_id,endpoint' })

  return NextResponse.json({ ok: true })
}

// Toggle notifications on/off (doesn't delete the subscription, just disables)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled } = await req.json() as { enabled: boolean }

  await supabaseAdmin
    .from('push_subscriptions')
    .update({ enabled })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}

// Delete all subscriptions for this user
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
