-- Hallazgo de la auditoría 2026-08-10: el advisor de seguridad de Supabase
-- sigue marcando handle_new_user() y get_last_session_activity() como
-- ejecutables por anon/authenticated.
--
-- ─────────────────────────────────────────────────────────────────────────
-- is_admin() / is_internal_staff(): NO se tocan.
-- Ya se revisaron a fondo el 2026-07-04 (ver 20260704000007) y se decidió
-- dejarlas ejecutables por cualquiera a propósito: solo responden sobre la
-- propia identidad del caller (auth.uid()), sin exponer datos de otros
-- usuarios ni efectos secundarios. Esta migración no revierte esa decisión.
-- ─────────────────────────────────────────────────────────────────────────

-- handle_new_user(): la migración 20260704000007 ya revocó EXECUTE de anon
-- y authenticated puntualmente, pero el advisor la sigue mostrando abierta.
-- Postgres otorga EXECUTE a PUBLIC por default en CREATE FUNCTION, y un
-- REVOKE de un rol específico no alcanza a los que heredan vía PUBLIC — hay
-- que revocar PUBLIC explícitamente. Es una función de trigger (RETURNS
-- trigger, usa NEW), Postgres ya rechaza invocarla fuera de un trigger, así
-- que esto es higiene, no un exploit cerrado.
revoke execute on function public.handle_new_user() from public;

-- get_last_session_activity(): a diferencia de is_admin/is_internal_staff,
-- esta SÍ devuelve datos de TODOS los usuarios sin filtrar por el caller
-- (select ... group by s.user_id, sin where). La migración original
-- (20260706000002) solo hizo GRANT a service_role y nunca revocó el
-- default de PUBLIC — cualquiera, incluso sin sesión, podía pegarle a
-- /rest/v1/rpc/get_last_session_activity y sacar el last_active_at + user_id
-- de toda la base. service_role conserva su acceso (grant explícito, no
-- afectado por este revoke a PUBLIC).
revoke execute on function public.get_last_session_activity() from public;
revoke execute on function public.get_last_session_activity() from anon;
revoke execute on function public.get_last_session_activity() from authenticated;
