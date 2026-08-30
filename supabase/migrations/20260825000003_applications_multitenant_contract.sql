-- Sector interno multi-tenant — Fase 1: applications.
-- CONTRACT (paso 2 de 2, expand/contract). Aplicar SOLO después de que el
-- código de la rama crm/multitenant-kit (que setea client_id en cada
-- escritura y filtra por tenant en cada lectura) ya esté deployado en
-- producción. Antes de eso, aplicar esto rompe /apply (insert sin
-- client_id -> viola NOT NULL) para todo el que use el form público.
--
-- Ver 20260825000001_applications_multitenant_expand.sql para el resto
-- del contexto de por qué está partido en dos pasos.

-- Re-backfill: cubre filas que hayan entrado con client_id NULL entre el
-- expand y el deploy del código.
update public.applications
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.applications alter column client_id set not null;

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
