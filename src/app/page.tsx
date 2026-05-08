import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'
import type { Baby, Weight } from '@/lib/supabase/types'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: caregiverRows } = await supabase
    .from('baby_caregivers')
    .select('baby_id, role, babies(*)')
    .eq('user_id', user.id)

  const babies = (caregiverRows ?? []).map((row) => {
    const babyData = Array.isArray(row.babies) ? row.babies[0] : row.babies
    return { ...(babyData as Baby), role: row.role }
  })

  if (babies.length === 0) redirect('/onboarding')

  const baby = babies[0]

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [feedingsRes, diapersRes, sleepsRes, weightsRes] = await Promise.all([
    supabase
      .from('feedings')
      .select('*')
      .eq('baby_id', baby.id as string)
      .gte('fed_at', todayISO)
      .order('fed_at', { ascending: false }),
    supabase
      .from('diapers')
      .select('*')
      .eq('baby_id', baby.id as string)
      .gte('changed_at', todayISO)
      .order('changed_at', { ascending: false }),
    supabase
      .from('sleeps')
      .select('*')
      .eq('baby_id', baby.id as string)
      .gte('started_at', todayISO)
      .order('started_at', { ascending: false }),
    supabase
      .from('weights')
      .select('*')
      .eq('baby_id', baby.id as string)
      .order('weighed_at', { ascending: false })
      .limit(20),
  ])

  const [lifetimeFeedingsRes, lifetimeDiapersRes] = await Promise.all([
    supabase.from('feedings').select('amount_ml').eq('baby_id', baby.id as string),
    supabase.from('diapers').select('type').eq('baby_id', baby.id as string),
  ])

  const lifetimeTotalMl = (lifetimeFeedingsRes.data ?? []).reduce((s, f) => s + f.amount_ml, 0)
  const lifetimePoops = (lifetimeDiapersRes.data ?? []).filter(d => d.type === 'poop' || d.type === 'mixed').length
  const lifetimePees = (lifetimeDiapersRes.data ?? []).filter(d => d.type === 'pee' || d.type === 'mixed').length

  return (
    <DashboardClient
      user={{ id: user.id, email: user.email ?? '' }}
      baby={baby as Parameters<typeof DashboardClient>[0]['baby']}
      profile={profile ?? { id: user.id, email: user.email ?? '', unit_preference: 'ml', display_name: null, created_at: '', updated_at: '' }}
      todayFeedings={feedingsRes.data ?? []}
      todayDiapers={diapersRes.data ?? []}
      todaySleeps={sleepsRes.data ?? []}
      recentWeights={(weightsRes.data ?? []) as Weight[]}
      lifetimeStats={{ totalMl: lifetimeTotalMl, poops: lifetimePoops, pees: lifetimePees }}
    />
  )
}
