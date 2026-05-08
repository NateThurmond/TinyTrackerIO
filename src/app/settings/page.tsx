import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const { data: caregiverRows } = await supabase
    .from('baby_caregivers')
    .select('baby_id, role, babies(*)')
    .eq('user_id', user.id)

  const baby = (caregiverRows?.[0]?.babies ?? null) as Record<string, unknown> | null
  const role = caregiverRows?.[0]?.role ?? 'caregiver'

  const caregivers = baby
    ? await supabase
        .from('baby_caregivers')
        .select('*, profiles(display_name, email)')
        .eq('baby_id', baby.id as string)
    : { data: [] }

  return (
    <SettingsClient
      user={{ id: user.id, email: user.email ?? '' }}
      profile={profile ?? { id: user.id, email: user.email ?? '', display_name: null, unit_preference: 'ml', created_at: '', updated_at: '' }}
      baby={baby}
      role={role as 'owner' | 'caregiver'}
      caregivers={caregivers.data ?? []}
    />
  )
}
