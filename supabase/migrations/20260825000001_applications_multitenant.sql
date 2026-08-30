-- Sector interno multi-tenant — Fase 1 (panel interno por cliente): applications.
--
-- `applications` no tenía ningún tipo de aislamiento por tenant — cualquier
-- interno con role=admin/team/setter veía las aplicaciones de TODOS los
-- clientes y de Smart Scale mezcladas (nombre, email y datos de gente que
-- aplicó: fuga de PII de terceros entre empresas distintas, no un bug de
-- nav). Mismo patrón que 20260812150007_leads_multitenant.sql.
--
-- RLS actual: solo service_role_all — no hay ninguna policy para
-- `authenticated` que reemplazar, solo agregar la nueva.

alter table public.applications add column if not exists client_id uuid references public.clients(id);

update public.applications
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.applications alter column client_id set not null;

create index if not exists applications_client_id_idx on public.applications (client_id);

create policy "applications_tenant_access" on public.applications
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
