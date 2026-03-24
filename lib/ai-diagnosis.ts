import { createClient } from '@/lib/supabase'

// Obtiene el último diagnóstico AI para un usuario
export async function getLatestAIDiagnosisRequest({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_diagnosis_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('getLatestAIDiagnosisRequest error:', error)
    return null
  }
  return data ?? null
}

// Obtiene el historial de diagnósticos AI para un usuario
export async function getAIDiagnosisHistory({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_diagnosis_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getAIDiagnosisHistory error:', error)
    return []
  }
  return data || []
}

// Obtiene el resultado de un diagnóstico AI por requestId
export async function getAIDiagnosisResult(requestId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_diagnosis_results')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}