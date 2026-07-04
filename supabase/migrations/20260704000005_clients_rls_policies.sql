-- Hallazgo nuevo (advisor de Supabase, 2026-07-04): clients tenía RLS enabled
-- sin policies. dashboard-layout.tsx lee su propia fila (clients.nombre como
-- fallback de display name) directo desde el browser — sin policy, esa
-- consulta siempre devuelve vacío (funcionalidad rota, no fuga de datos).
create policy "client_read_own" on public.clients
  for select
  using (
    id in (select p.client_id from public.profiles p where p.id = auth.uid())
  );

-- Staff interno (admin/team/setter) puede leer cualquier cliente — mismo
-- helper que ya usa profiles (is_internal_staff, de 20260531000001).
create policy "internal_staff_read_all_clients" on public.clients
  for select
  using (public.is_internal_staff());
