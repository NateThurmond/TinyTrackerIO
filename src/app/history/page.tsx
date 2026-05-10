import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HistoryClient from '@/components/HistoryClient'
import { getLocalDateKey, parseLocalDateKey } from '@/lib/utils'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string; mode?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const tab = (params.tab ?? 'feeding') as 'feeding' | 'diaper' | 'sleep'
  const date = params.date ?? getLocalDateKey()
  const mode = (params.mode === 'list' ? 'list' : 'chart') as 'list' | 'chart'

  const start = parseLocalDateKey(date)
  const end = parseLocalDateKey(date)
  end.setHours(23, 59, 59, 999)

  const { data: caregiverRows } = await supabase
    .from('baby_caregivers')
    .select('baby_id, babies(*)')
    .eq('user_id', user.id)

  const baby = (caregiverRows?.[0]?.babies ?? null) as Record<string, unknown> | null
  if (!baby) redirect('/onboarding')

  const profile = await supabase.from('profiles').select('unit_preference').eq('id', user.id).single()

  const [feedingsRes, diapersRes, sleepsRes] = await Promise.all([
    supabase
      .from('feedings').select('*')
      .eq('baby_id', baby.id as string)
      .gte('fed_at', start.toISOString())
      .lte('fed_at', end.toISOString())
      .order('fed_at', { ascending: false }),
    supabase
      .from('diapers').select('*')
      .eq('baby_id', baby.id as string)
      .gte('changed_at', start.toISOString())
      .lte('changed_at', end.toISOString())
      .order('changed_at', { ascending: false }),
    supabase
      .from('sleeps').select('*')
      .eq('baby_id', baby.id as string)
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .order('started_at', { ascending: false }),
  ])

  return (
    <HistoryClient
      tab={tab}
      date={date}
      mode={mode}
      babyId={baby.id as string}
      unit={(profile.data?.unit_preference ?? 'ml') as 'ml' | 'oz'}
      feedings={feedingsRes.data ?? []}
      diapers={diapersRes.data ?? []}
      sleeps={sleepsRes.data ?? []}
    />
  )
}
