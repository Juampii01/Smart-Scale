-- Centro Operativo — pages tipo Notion. Estructura jerárquica con bloques BlockNote.
-- Cada page tiene un `scope` que controla quién la ve/edita.

create table if not exists public.centro_op_pages (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.centro_op_pages(id) on delete cascade,
  title       text not null default 'Sin título',
  icon        text,                                                       -- emoji o nombre de lucide
  content     jsonb not null default '[]'::jsonb,                         -- array de bloques BlockNote
  sort_order  integer not null default 0,                                 -- orden entre siblings
  scope       text   not null default 'global',                           -- 'global' | 'prospeccion'
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists centro_op_pages_parent_idx     on public.centro_op_pages (parent_id);
create index if not exists centro_op_pages_scope_idx      on public.centro_op_pages (scope);
create index if not exists centro_op_pages_sort_idx       on public.centro_op_pages (parent_id, sort_order);
create index if not exists centro_op_pages_updated_at_idx on public.centro_op_pages (updated_at desc);

alter table public.centro_op_pages enable row level security;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS — ver matriz:
--                          read    insert  update  delete
--   admin                  all     all     all     all
--   team                   global  global  global  global   (no toca prospeccion)
--   setter                 prosp   prosp   prosp   prosp    (solo prospeccion)
--   cliente / null         —       —       —       —
-- ──────────────────────────────────────────────────────────────────────────────

drop policy if exists "centro_op_pages_select" on public.centro_op_pages;
create policy "centro_op_pages_select"
  on public.centro_op_pages for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
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
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
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
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
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
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          lower(coalesce(p.role,'')) = 'admin'
          or (lower(coalesce(p.role,'')) = 'team'   and scope = 'global')
          or (lower(coalesce(p.role,'')) = 'setter' and scope = 'prospeccion')
        )
    )
  );

-- Trigger updated_at
create or replace function public.set_centro_op_pages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists centro_op_pages_set_updated_at on public.centro_op_pages;
create trigger centro_op_pages_set_updated_at
  before update on public.centro_op_pages
  for each row execute function public.set_centro_op_pages_updated_at();
