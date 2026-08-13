-- Sector interno multi-tenant — paso 4: prospeccion_items.
--
-- La migración original (supabase/migrations/prospeccion.sql, sin prefijo
-- de timestamp) nunca se aplicó a producción — confirmado con
-- list_migrations e information_schema. La tabla no existe. Se crea acá
-- ya multi-tenant desde el día uno (no hay backfill que hacer).

create table public.prospeccion_items (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id),
  setter_id    uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  content      text,
  item_type    text not null default 'nota',
  tags         text[] not null default array[]::text[],
  status       text not null default 'activo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index prospeccion_items_client_id_idx  on public.prospeccion_items (client_id);
create index prospeccion_items_setter_id_idx  on public.prospeccion_items (setter_id);
create index prospeccion_items_tags_idx       on public.prospeccion_items using gin (tags);

alter table public.prospeccion_items enable row level security;

create policy "service_role_all" on public.prospeccion_items
  for all to service_role using (true) with check (true);

-- Setter: solo sus propios items, dentro de su propio tenant.
create policy "prospeccion_setter_own" on public.prospeccion_items
  for all to authenticated
  using (
    setter_id = (select auth.uid())
    and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    setter_id = (select auth.uid())
    and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );

-- Admin/developer del tenant: ve/edita todo lo de SU tenant (audit).
-- Platform owner: todo, cualquier tenant.
create policy "prospeccion_admin_tenant_or_owner" on public.prospeccion_items
  for all to authenticated
  using (
    public.is_platform_owner()
    or (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()) and lower(coalesce(p.role, '')) in ('admin', 'developer'))
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  )
  with check (
    public.is_platform_owner()
    or (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()) and lower(coalesce(p.role, '')) in ('admin', 'developer'))
      and client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
    )
  );

create or replace function public.set_prospeccion_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prospeccion_items_set_updated_at
  before update on public.prospeccion_items
  for each row execute function public.set_prospeccion_updated_at();
