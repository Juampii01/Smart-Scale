-- Sector interno multi-tenant — Fase 0.5: sops.
--
-- `sops` es un tab DENTRO de Centro Operativo, que el prompt del panel
-- interno por cliente asumía ya aislado (comparte pantalla con
-- centro_op_pages, que sí lo está). No lo estaba: cero columna de tenant,
-- y sus policies de RLS (`internal_read_sops` etc., de sops.sql) solo
-- miran el rol, nunca el tenant. Un admin/team/setter de un cliente vería
-- y podría editar/borrar los SOPs de Smart Scale mezclados con los suyos
-- — peor que un hallazgo founder-only, porque la pantalla YA está en el
-- kit del cliente, no hace falta adivinar una URL.
--
-- Mismo patrón que leads_multitenant.sql / applications_multitenant.sql,
-- pero acá SÍ hay policies previas para `authenticated` que reemplazar
-- (no solo agregar): dejarlas vivas en paralelo a las nuevas seguiría
-- dando acceso cross-tenant, porque Postgres las combina con OR.

alter table public.sops add column if not exists client_id uuid references public.clients(id);

update public.sops
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.sops alter column client_id set not null;

create index if not exists sops_client_id_idx on public.sops (client_id);

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
