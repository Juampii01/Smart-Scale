-- Sector interno multi-tenant — paso 6: leads + lead_columns.
--
-- RLS actual: solo service_role_all — no hay ninguna policy para
-- `authenticated` que reemplazar, solo agregar la nueva.

alter table public.leads add column if not exists client_id uuid references public.clients(id);

update public.leads
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.leads alter column client_id set not null;

create index if not exists leads_client_id_idx on public.leads (client_id);

create policy "leads_tenant_access" on public.leads
  for all to authenticated
  using (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );

-- lead_columns: columnas custom del Kanban. Hoy `key` es UNIQUE global —
-- si dos tenants quisieran una columna con el mismo key, colisionarían, y
-- cualquier tenant vería el schema (nombres de columnas custom) de todos
-- los demás. Se scopea igual, y el UNIQUE pasa a ser por (client_id, key).

alter table public.lead_columns add column if not exists client_id uuid references public.clients(id);

update public.lead_columns
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

alter table public.lead_columns alter column client_id set not null;

alter table public.lead_columns drop constraint if exists lead_columns_key_key;
alter table public.lead_columns add constraint lead_columns_client_key_uniq unique (client_id, key);

create policy "lead_columns_tenant_access" on public.lead_columns
  for all to authenticated
  using (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );
