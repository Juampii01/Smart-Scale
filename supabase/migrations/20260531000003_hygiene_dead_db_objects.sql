-- ═══════════════════════════════════════════════════════════════════════════════
-- HYGIENE — Dead DB objects
-- Aplica: 2026-05-31
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DROP admin_uncomplete_day — dead code confirmado
--
-- La función referencia tablas que no existen en el schema actual:
--   day_progress, video_capsule_completions, video_capsules, user_events,
--   users (con columna total_points).
-- Cualquier llamada via /rest/v1/rpc falla con "relation does not exist".
-- Era callable por anon y authenticated (SECURITY DEFINER), lo que
-- constituía un RPC endpoint inútil expuesto públicamente.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_uncomplete_day(uuid, integer);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DROP policy INSERT duplicada en research_requests
--
-- Existen dos policies con idéntico WITH CHECK (auth.uid() = user_id):
--   "Insert own requests"          → roles {public}
--   "Users can insert their own research requests" → roles {authenticated}
-- La primera (roles {public}) incluye a anon además de authenticated,
-- lo que la hace más permisiva de lo necesario.
-- Dejamos solo la policy con role explícito {authenticated}.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Insert own requests" ON public.research_requests;
