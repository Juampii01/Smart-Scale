import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client for server-side API routes.
 * Never expose this on the client — it bypasses RLS.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
