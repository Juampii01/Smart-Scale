/**
 * Client-Setter Connection Helpers
 * Utilities for managing which setter (closer) is connected to each client
 */

import { createServiceClient } from "@/lib/supabase-service"

export interface ClientInfo {
  id: string
  name: string
  email: string
  closer_id: string | null
  closer_name?: string | null
  status: string
  program_start: string
  total_amount: number
}

/**
 * Get all clients for a specific setter (closer)
 */
export async function getClientsByCloser(closerId: string): Promise<ClientInfo[]> {
  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select("id, name, email, closer_id, status, program_start, total_amount")
    .eq("closer_id", closerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clients by closer:", error)
    return []
  }

  // Enrich with closer name
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", closerId)
    .maybeSingle()

  return (clients || []).map((c) => ({
    ...c,
    total_amount: Number(c.total_amount || 0),
    closer_name: (profile as any)?.name,
  }))
}

/**
 * Get all clients and show which ones are missing a closer_id
 */
export async function getClientsWithoutCloser(): Promise<ClientInfo[]> {
  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select("id, name, email, closer_id, status, program_start, total_amount")
    .is("closer_id", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clients without closer:", error)
    return []
  }

  return (clients || []).map((c) => ({
    ...c,
    total_amount: Number(c.total_amount || 0),
  }))
}

/**
 * Set a closer for a client
 */
export async function setClientCloser(
  clientId: string,
  closerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from("crm_clients")
    .update({ closer_id: closerId })
    .eq("id", clientId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Bulk set closer for multiple clients
 */
export async function setClientCloserBulk(
  clientIds: string[],
  closerId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const supabase = createServiceClient()

  const { error, data } = await supabase
    .from("crm_clients")
    .update({ closer_id: closerId })
    .in("id", clientIds)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, count: clientIds.length }
}

/**
 * Get summary: how many clients per closer
 */
export async function getCloserSummary(): Promise<
  Array<{
    closer_id: string
    closer_name: string | null
    client_count: number
    total_mrr: number
  }>
> {
  const supabase = createServiceClient()

  const { data: closers, error: closersErr } = await supabase
    .from("profiles")
    .select("id, name, role")
    .in("role", ["setter", "team", "admin", "developer"])

  if (closersErr || !closers) return []

  const summary = []

  for (const closer of closers) {
    const { data: clients } = await supabase
      .from("crm_clients")
      .select("total_amount")
      .eq("closer_id", closer.id)
      .eq("status", "activo")

    const totalMRR = (clients || []).reduce(
      (sum, c) => sum + Number(c.total_amount || 0),
      0
    )
    const clientCount = clients?.length || 0

    summary.push({
      closer_id: closer.id,
      closer_name: closer.name,
      client_count: clientCount,
      total_mrr: Math.round(totalMRR * 100) / 100,
    })
  }

  return summary.filter((s) => s.client_count > 0)
}
