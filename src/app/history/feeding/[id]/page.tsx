import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditFeedingClient from '@/components/EditFeedingClient'

export default async function EditFeedingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: feeding } = await supabase.from('feedings').select('*').eq('id', id).single()
  if (!feeding) notFound()

  const { data: profile } = await supabase.from('profiles').select('unit_preference').eq('id', user.id).single()

  return <EditFeedingClient feeding={feeding} unit={(profile?.unit_preference ?? 'ml') as 'ml' | 'oz'} />
}
