-- Sector interno multi-tenant — paso 5: setting_daily_logs.
--
-- RLS actual: solo service_role_all (verificado con pg_policies) — no hay
-- ninguna policy para `authenticated` que reemplazar, solo agregar la nueva.
-- unique(setter_id, date) sigue siendo correcto tal cual: un setter
-- pertenece a un solo tenant.

alter table public.setting_daily_logs add column if not exists client_id uuid references public.clients(id);

update public.setting_daily_logs
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.setting_daily_logs alter column client_id set not null;

create index if not exists setting_daily_logs_client_id_idx on public.setting_daily_logs (client_id);

create policy "setting_daily_logs_tenant_access" on public.setting_daily_logs
  for all to authenticated
  using (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );
