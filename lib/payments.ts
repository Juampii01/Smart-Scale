import { createServiceClient } from "@/lib/supabase-service"

/**
 * Resuelve el cliente de un pago por email y sugiere la cuota impaga que
 * coincide en monto — nunca marca nada pagado sola, solo deja la sugerencia
 * para que se confirme con un click en /admin/payments. Usado tanto por el
 * webhook de Stripe/Zapier como por el alta manual desde /admin/payments,
 * para que ambos caminos reconcilien igual.
 */
export async function resolveClientAndSuggestion(
  supabase: ReturnType<typeof createServiceClient>,
  email: string | null,
  amount: number,
  status: string
): Promise<{ clientId: string | null; suggestedInstallmentId: string | null }> {
  const normalizedEmail = email ? email.trim().toLowerCase() : null
  if (!normalizedEmail) return { clientId: null, suggestedInstallmentId: null }

  const { data: client } = await supabase
    .from("crm_clients")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle()
  const clientId = (client as any)?.id ?? null
  if (!clientId || status !== "aceptado") return { clientId, suggestedInstallmentId: null }

  const { data: installment } = await supabase
    .from("crm_installments")
    .select("id")
    .eq("client_id", clientId)
    .is("paid_at", null)
    .eq("amount", amount)
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle()

  return { clientId, suggestedInstallmentId: (installment as any)?.id ?? null }
}
