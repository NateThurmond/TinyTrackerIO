import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AlarmsClient from '@/components/AlarmsClient'

export default async function AlarmsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caregiverRows } = await supabase
    .from('baby_caregivers')
    .select('baby_id, babies(*)')
    .eq('user_id', user.id)

  const baby = (caregiverRows?.[0]?.babies ?? null) as Record<string, unknown> | null
  if (!baby) redirect('/onboarding')

  const { data: alarms } = await supabase
    .from('alarms')
    .select('*')
    .eq('baby_id', baby.id as string)
    .order('created_at', { ascending: false })

  return <AlarmsClient babyId={baby.id as string} userId={user.id} alarms={alarms ?? []} />
}
