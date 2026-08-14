-- Sector interno multi-tenant — completa crm_clients, que quedó afuera de la
-- tanda original (20260812150002 en adelante). Sin esto, /api/admin/setting/
-- commissions y /api/admin/setting/onboardings-count no tienen forma de
-- filtrar por tenant: cualquier interno ve las comisiones y onboardings de
-- TODOS los tenants mezclados, y "Ver Clientes" es cosmético ahí.
--
-- RLS actual: solo service_role_all_clients — no hay ninguna policy para
-- `authenticated` que reemplazar, solo agregar la nueva (mismo patrón que
-- leads_multitenant.sql / setting_daily_logs_multitenant.sql).

alter table public.crm_clients add column if not exists client_id uuid references public.clients(id);

update public.crm_clients
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.crm_clients alter column client_id set not null;

create index if not exists crm_clients_client_id_idx on public.crm_clients (client_id);

create policy "crm_clients_tenant_access" on public.crm_clients
  for all to authenticated
  using (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );

notify pgrst, 'reload schema';
