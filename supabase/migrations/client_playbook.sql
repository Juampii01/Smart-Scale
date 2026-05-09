-- ============================================================================
-- Client Playbook — Documentos del cliente + Playbook único admin-only
--
-- 2 tablas:
--   client_playbook_pages — multi-page tipo Notion. Cada cliente tiene su
--                           propio set de páginas. Editan admin/team Y client.
--                           Se autosiembran 4 docs al primer load (Investigación,
--                           Avatar, Oferta, IP) — el seed se hace en el client
--                           via API, no en SQL.
--   client_playbook_main  — UN row por cliente. Solo admin/team escribe el
--                           texto; el cliente solo puede tildar checkboxes.
--                           El check "solo checkboxes" se hace server-side
--                           en el route handler (no en RLS, porque RLS no
--                           introspecciona jsonb diffs).
-- ============================================================================

-- ── client_playbook_pages ───────────────────────────────────────────────────

create table if not exists public.client_playbook_pages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null,
  parent_id    uuid references public.client_playbook_pages(id) on delete cascade,
  title        text not null default 'Sin título',
  icon         text,
  content      jsonb not null default '[]'::jsonb,
  sort_order   int  not null default 0,
  is_seed      boolean not null default false,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists client_playbook_pages_client_idx
  on public.client_playbook_pages (client_id, parent_id, sort_order);
create index if not exists client_playbook_pages_updated_idx
  on public.client_playbook_pages (updated_at desc);

alter table public.client_playbook_pages enable row level security;

drop policy if exists "client_playbook_pages_select" on public.client_playbook_pages;
create policy "client_playbook_pages_select" on public.client_playbook_pages for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and (
      lower(coalesce(p.role,'')) in ('admin','team')
      or (lower(coalesce(p.role,'')) = 'client' and p.client_id = client_playbook_pages.client_id)
    )
));

drop policy if exists "client_playbook_pages_insert" on public.client_playbook_pages;
create policy "client_playbook_pages_insert" on public.client_playbook_pages for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and (
      lower(coalesce(p.role,'')) in ('admin','team')
      or (lower(coalesce(p.role,'')) = 'client' and p.client_id = client_playbook_pages.client_id)
    )
));

drop policy if exists "client_playbook_pages_update" on public.client_playbook_pages;
create policy "client_playbook_pages_update" on public.client_playbook_pages for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and (
      lower(coalesce(p.role,'')) in ('admin','team')
      or (lower(coalesce(p.role,'')) = 'client' and p.client_id = client_playbook_pages.client_id)
    )
));

drop policy if exists "client_playbook_pages_delete" on public.client_playbook_pages;
create policy "client_playbook_pages_delete" on public.client_playbook_pages for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and lower(coalesce(p.role,'')) in ('admin','team')
));

create or replace function public.set_client_playbook_pages_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists client_playbook_pages_set_updated_at on public.client_playbook_pages;
create trigger client_playbook_pages_set_updated_at
before update on public.client_playbook_pages
for each row execute function public.set_client_playbook_pages_updated_at();


-- ── client_playbook_main ────────────────────────────────────────────────────

create table if not exists public.client_playbook_main (
  client_id    uuid primary key,
  content      jsonb not null default '[]'::jsonb,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists client_playbook_main_updated_idx
  on public.client_playbook_main (updated_at desc);

alter table public.client_playbook_main enable row level security;

drop policy if exists "client_playbook_main_select" on public.client_playbook_main;
create policy "client_playbook_main_select" on public.client_playbook_main for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and (
      lower(coalesce(p.role,'')) in ('admin','team')
      or (lower(coalesce(p.role,'')) = 'client' and p.client_id = client_playbook_main.client_id)
    )
));

-- Insert: solo admin/team. El cliente nunca crea el playbook desde cero.
drop policy if exists "client_playbook_main_insert" on public.client_playbook_main;
create policy "client_playbook_main_insert" on public.client_playbook_main for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and lower(coalesce(p.role,'')) in ('admin','team')
));

-- Update: admin/team siempre. Cliente solo el suyo.
-- IMPORTANTE: la regla "cliente solo puede tildar checkboxes, no editar texto"
-- la enforce el route handler en /api/client-playbook-main, no esta política.
-- El cliente que se salta el route y va directo al table tendría escritura
-- libre — para mitigarlo, la app NUNCA expone client-side el service-role
-- key, y los clients no tienen privilegios para usar postgrest libremente.
drop policy if exists "client_playbook_main_update" on public.client_playbook_main;
create policy "client_playbook_main_update" on public.client_playbook_main for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and (
      lower(coalesce(p.role,'')) in ('admin','team')
      or (lower(coalesce(p.role,'')) = 'client' and p.client_id = client_playbook_main.client_id)
    )
));

drop policy if exists "client_playbook_main_delete" on public.client_playbook_main;
create policy "client_playbook_main_delete" on public.client_playbook_main for delete
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and lower(coalesce(p.role,'')) = 'admin'
));

create or replace function public.set_client_playbook_main_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists client_playbook_main_set_updated_at on public.client_playbook_main;
create trigger client_playbook_main_set_updated_at
before update on public.client_playbook_main
for each row execute function public.set_client_playbook_main_updated_at();
