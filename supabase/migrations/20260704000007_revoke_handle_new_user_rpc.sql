-- Hallazgo nuevo (advisor de Supabase, 2026-07-04): handle_new_user() es
-- SECURITY DEFINER y queda expuesto como RPC público. Es una función trigger
-- (RETURNS trigger, usa NEW) — Postgres ya rechaza invocarla fuera de un
-- trigger, así que no es explotable, pero no hay motivo para dejar el
-- permiso de EXECUTE abierto igual (higiene, mismo criterio que
-- is_internal_staff en 20260531000001).
--
-- is_admin() e is_internal_staff() se revisaron y NO se tocan: solo
-- responden sobre la propia identidad del caller (auth.uid()), sin exponer
-- datos de otros usuarios ni efectos secundarios — son seguras invocadas
-- directo por diseño.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
