-- Sector interno multi-tenant — sops.
-- CONTRACT (paso 2 de 2, expand/contract). Aplicar SOLO después de que el
-- código de crm/multitenant-kit ya esté deployado en producción. Antes de
-- eso, aplicar esto rompe la creación de SOPs desde `main` (insert sin
-- client_id -> NOT NULL) y además la nueva policy de insert exige
-- client_id = internal_tenant_id, que el código viejo no setea.
--
-- Reemplaza (no agrega al lado de) las 4 policies viejas de sops.sql —
-- dejarlas vivas en paralelo a las nuevas seguiría dando acceso
-- cross-tenant, porque Postgres combina policies permisivas con OR.
--
-- Ver 20260825000002_sops_multitenant_expand.sql para el resto del
-- contexto de por qué está partido en dos pasos.

-- Re-backfill: cubre filas que hayan entrado con client_id NULL entre el
-- expand y el deploy del código.
update public.sops
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.sops alter column client_id set not null;

-- Lectura: admin/team/setter, y solo de su propio tenant (o platform owner).
drop policy if exists "internal_read_sops" on public.sops;
create policy "internal_read_sops"
  on public.sops for select
  using (
    public.is_platform_owner()
    or (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and lower(coalesce(profiles.role, '')) in ('admin', 'team', 'setter')
      )
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  );

-- Escritura: solo admin de su propio tenant (o platform owner).
drop policy if exists "admin_insert_sops" on public.sops;
create policy "admin_insert_sops"
  on public.sops for insert
  with check (
    public.is_platform_owner()
    or (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and lower(coalesce(profiles.role, '')) = 'admin'
      )
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  );

drop policy if exists "admin_update_sops" on public.sops;
create policy "admin_update_sops"
  on public.sops for update
  using (
    public.is_platform_owner()
    or (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and lower(coalesce(profiles.role, '')) = 'admin'
      )
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  );

drop policy if exists "admin_delete_sops" on public.sops;
create policy "admin_delete_sops"
  on public.sops for delete
  using (
    public.is_platform_owner()
    or (
      exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and lower(coalesce(profiles.role, '')) = 'admin'
      )
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  );

notify pgrst, 'reload schema';
