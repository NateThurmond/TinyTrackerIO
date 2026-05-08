import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditDiaperClient from '@/components/EditDiaperClient'

export default async function EditDiaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: diaper } = await supabase.from('diapers').select('*').eq('id', id).single()
  if (!diaper) notFound()

  return <EditDiaperClient diaper={diaper} />
}
