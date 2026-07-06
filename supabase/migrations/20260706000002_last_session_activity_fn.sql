-- auth.users.last_sign_in_at solo se actualiza en un login "fresco" (nueva
-- autenticación) — con sesión persistente (refresh token via @supabase/ssr),
-- un cliente puede usar la app todos los días sin que ese campo se mueva
-- nunca más. auth.sessions.refreshed_at sí se actualiza en cada refresh de
-- token, y es la señal real de "última vez que estuvo activo".
--
-- auth.sessions no está expuesto vía PostgREST (por diseño de Supabase), así
-- que se necesita esta función SECURITY DEFINER para poder leerlo desde el
-- cliente normal de la app (createServiceClient) vía rpc().
create or replace function public.get_last_session_activity()
returns table (user_id uuid, last_active_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.user_id, max(coalesce(s.refreshed_at::timestamptz, s.created_at)) as last_active_at
  from auth.sessions s
  group by s.user_id;
$$;

grant execute on function public.get_last_session_activity() to service_role;
