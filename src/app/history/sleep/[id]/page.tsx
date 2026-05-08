import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditSleepClient from '@/components/EditSleepClient'

export default async function EditSleepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sleep } = await supabase.from('sleeps').select('*').eq('id', id).single()
  if (!sleep) notFound()

  return <EditSleepClient sleep={sleep} />
}
