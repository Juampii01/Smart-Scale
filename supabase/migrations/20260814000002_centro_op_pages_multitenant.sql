-- Sector interno multi-tenant — Centro Operativo. Hasta ahora centro_op_pages
-- era una tabla única compartida por TODOS los tenants: un cliente con
-- sector interno propio veía/editaba las mismas páginas que Smart Scale y
-- que cualquier otro cliente. Se aísla igual que leads/setting_daily_logs.

alter table public.centro_op_pages add column if not exists client_id uuid references public.clients(id);

update public.centro_op_pages
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.centro_op_pages alter column client_id set not null;

create index if not exists centro_op_pages_client_id_idx on public.centro_op_pages (client_id);

-- Reemplaza las policies por rol por versiones que además exigen mismo
-- tenant (o platform owner). Mismo criterio de scope (global/prospeccion)
-- que ya tenían, ahora cruzado con client_id.

drop policy if exists "centro_op_pages_select" on public.centro_op_pages;
create policy "centro_op_pages_select"
  on public.centro_op_pages for select
  using (
    public.is_platform_owner()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.internal_tenant_id = centro_op_pages.client_id
        and (
          lower(coalesce(p.role,'')) = 'admin'
          or (lower(coalesce(p.role,'')) = 'team'   and scope = 'global')
          or (lower(coalesce(p.role,'')) = 'setter' and scope = 'prospeccion')
        )
    )
  );

drop policy if exists "centro_op_pages_insert" on public.centro_op_pages;
create policy "centro_op_pages_insert"
  on public.centro_op_pages for insert
  with check (
    public.is_platform_owner()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.internal_tenant_id = centro_op_pages.client_id
        and (
          lower(coalesce(p.role,'')) = 'admin'
          or (lower(coalesce(p.role,'')) = 'team'   and scope = 'global')
          or (lower(coalesce(p.role,'')) = 'setter' and scope = 'prospeccion')
        )
    )
  );

drop policy if exists "centro_op_pages_update" on public.centro_op_pages;
create policy "centro_op_pages_update"
  on public.centro_op_pages for update
  using (
    public.is_platform_owner()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.internal_tenant_id = centro_op_pages.client_id
        and (
          lower(coalesce(p.role,'')) = 'admin'
          or (lower(coalesce(p.role,'')) = 'team'   and scope = 'global')
          or (lower(coalesce(p.role,'')) = 'setter' and scope = 'prospeccion')
        )
    )
  );

drop policy if exists "centro_op_pages_delete" on public.centro_op_pages;
create policy "centro_op_pages_delete"
  on public.centro_op_pages for delete
  using (
    public.is_platform_owner()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.internal_tenant_id = centro_op_pages.client_id
        and (
          lower(coalesce(p.role,'')) = 'admin'
          or (lower(coalesce(p.role,'')) = 'team'   and scope = 'global')
          or (lower(coalesce(p.role,'')) = 'setter' and scope = 'prospeccion')
        )
    )
  );

notify pgrst, 'reload schema';
