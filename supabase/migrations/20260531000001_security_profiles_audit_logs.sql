-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY REMEDIATION — PR1
-- Aplica: 2026-05-31
-- Refs:   C-01 (privilege escalation via profiles UPDATE)
--         A-03 (profiles SELECT expuesto a todos los autenticados)
--         A-04 (audit_logs INSERT abierto a anon)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- C-01: Bloquear escalamiento de privilegios via profiles UPDATE
--
-- Decisión: REVOKE UPDATE en lugar de WITH CHECK.
-- Motivo: ningún componente client-side hace .update()/.upsert() sobre profiles
-- directamente via PostgREST (verificado por grep en components/, hooks/, contexts/,
-- app/). Todo update de profiles pasa por API routes que usan service_role.
-- REVOKE es más limpio y no deja margen a futuros errores de policy.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

REVOKE UPDATE ON public.profiles FROM authenticated;

-- service_role conserva acceso total (su policy ya existe: "service_role_all")


-- ─────────────────────────────────────────────────────────────────────────────
-- A-03: Scopear profiles SELECT — clientes solo ven su propio perfil,
--       staff interno (admin/team/setter) ve todos.
--
-- Usamos una función SECURITY DEFINER como helper para evitar recursión infinita.
-- La policy "profiles_select_internal" necesita consultar profiles para saber el
-- rol del caller, pero como la función corre como owner (no como el usuario JWT),
-- no re-dispara RLS → sin "infinite recursion detected in policy".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'team', 'setter')
  );
$$;

-- Solo usuarios autenticados pueden invocarla; anon no tiene acceso
REVOKE EXECUTE ON FUNCTION public.is_internal_staff() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;

-- Reemplazar la policy permisiva existente
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- Política 1: cada usuario ve su propio perfil (cubre clientes y todos los roles)
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Política 2: staff interno ve todos los perfiles (necesario para admin UI, CRM,
-- new-user-dialog, view-as, magic-link, etc.)
CREATE POLICY "profiles_select_internal"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_internal_staff());


-- ─────────────────────────────────────────────────────────────────────────────
-- A-04: audit_logs INSERT — restringir a service_role únicamente.
--
-- La policy anterior aplicaba a roles={public} (incluye anon) con CHECK=true,
-- permitiendo a cualquiera inyectar logs falsos sin autenticación.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

CREATE POLICY "service_role_insert_audit_logs"
  ON public.audit_logs
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar manualmente después de aplicar):
--
-- 1. Cliente solo ve su propio perfil:
--    SET LOCAL role = authenticated;
--    SET LOCAL "request.jwt.claims" = '{"sub": "<uuid-cliente>"}';
--    SELECT id, role FROM profiles;
--    → debe retornar solo 1 fila (la propia)
--
-- 2. Admin ve todos los perfiles:
--    SET LOCAL "request.jwt.claims" = '{"sub": "<uuid-admin>"}';
--    SELECT count(*) FROM profiles;
--    → debe retornar el total de perfiles
--
-- 3. Intento de auto-promoción a admin (debe fallar con 403):
--    PATCH /rest/v1/profiles?id=eq.<uuid-cliente>
--    Authorization: Bearer <jwt-cliente>
--    {"role": "admin"}
--    → debe retornar 403 Forbidden (no permission to update)
-- ─────────────────────────────────────────────────────────────────────────────
