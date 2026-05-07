-- Prospección — workspace setter-only para guardar todo lo de prospección.
-- Cada setter ve únicamente sus propios items (RLS por setter_id = auth.uid()).
-- Admin tiene acceso total para auditoría / setup.

create table if not exists public.prospeccion_items (
  id           uuid primary key default gen_random_uuid(),
  setter_id    uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  content      text,                                                  -- markdown / plain
  item_type    text not null default 'nota'::text,                    -- 'lista' | 'script' | 'nota' | 'follow-up' (free text)
  tags         text[] not null default array[]::text[],
  status       text not null default 'activo'::text,                  -- 'activo' | 'archivado' | 'cerrado'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists prospeccion_items_setter_id_idx on public.prospeccion_items (setter_id);
create index if not exists prospeccion_items_tags_idx      on public.prospeccion_items using gin (tags);
create index if not exists prospeccion_items_created_at_idx on public.prospeccion_items (created_at desc);

alter table public.prospeccion_items enable row level security;

-- Setter ve / edita SOLO sus propios items
drop policy if exists "setter_own_items_select" on public.prospeccion_items;
create policy "setter_own_items_select"
  on public.prospeccion_items for select
  using (
    setter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'setter'
    )
  );

drop policy if exists "setter_own_items_insert" on public.prospeccion_items;
create policy "setter_own_items_insert"
  on public.prospeccion_items for insert
  with check (
    setter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'setter'
    )
  );

drop policy if exists "setter_own_items_update" on public.prospeccion_items;
create policy "setter_own_items_update"
  on public.prospeccion_items for update
  using (
    setter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'setter'
    )
  );

drop policy if exists "setter_own_items_delete" on public.prospeccion_items;
create policy "setter_own_items_delete"
  on public.prospeccion_items for delete
  using (
    setter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'setter'
    )
  );

-- Admin: acceso total (audit / setup). Lee y escribe todo.
drop policy if exists "admin_full_access_prospeccion" on public.prospeccion_items;
create policy "admin_full_access_prospeccion"
  on public.prospeccion_items for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

-- Trigger updated_at
create or replace function public.set_prospeccion_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospeccion_items_set_updated_at on public.prospeccion_items;
create trigger prospeccion_items_set_updated_at
  before update on public.prospeccion_items
  for each row execute function public.set_prospeccion_updated_at();
