import { createClient } from '@/lib/supabaseClient'

export async function getLatestResearchRequest({ userId }: { userId: string }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('research_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getLatestResearchRequest error:', error)
    return null
  }

  return data ?? null
}

export async function getResearchHistory({ userId }: { userId: string }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('research_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getResearchHistory error:', error)
    return []
  }

  return data || []
}

export async function getResearchResult(requestId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('research_results')
    .select('*')
    .eq('request_id', requestId)
    .single()
  if (error) throw error
  return data
}
