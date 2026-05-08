import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: caregiverRows } = await supabase
    .from('baby_caregivers')
    .select('baby_id, role, babies(*)')
    .eq('user_id', user.id)

  const baby = (caregiverRows?.[0]?.babies ?? null) as Record<string, unknown> | null
  const role = caregiverRows?.[0]?.role ?? 'caregiver'

  let caregivers: Array<{ user_id: string; role: string; profiles: { display_name: string | null; email: string } | null }> = []
  if (baby) {
    const { data: caregiversRaw } = await supabaseAdmin
      .from('baby_caregivers')
      .select('user_id, role')
      .eq('baby_id', baby.id as string)

    const userIds = (caregiversRaw ?? []).map((c) => c.user_id)
    const { data: profilesData } = userIds.length > 0
      ? await supabaseAdmin.from('profiles').select('id, display_name, email').in('id', userIds)
      : { data: [] }

    caregivers = (caregiversRaw ?? []).map((c) => ({
      user_id: c.user_id,
      role: c.role,
      profiles: (profilesData ?? []).find((p) => p.id === c.user_id) ?? null,
    }))
  }

  return (
    <SettingsClient
      user={{ id: user.id, email: user.email ?? '' }}
      profile={profile ?? { id: user.id, email: user.email ?? '', display_name: null, unit_preference: 'ml', created_at: '', updated_at: '' }}
      baby={baby}
      role={role as 'owner' | 'caregiver'}
      caregivers={caregivers}
    />
  )
}
