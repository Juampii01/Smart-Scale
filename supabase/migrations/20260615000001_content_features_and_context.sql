-- ════════════════════════════════════════════════════════════════════════════
-- Content features (Ideas / Competitors / Vault) + Context Room persistence
-- ════════════════════════════════════════════════════════════════════════════
-- Habilita la persistencia real (hoy en localStorage) de:
--   • content_ideas       → Instagram/YouTube → Ideas  (modal "Add Idea")
--   • content_competitors → Instagram/YouTube → Competitors
--   • content_vault       → Instagram/YouTube → Vault  (guardar reels/videos)
--   • client_context      → Context Room (los 7 tabs del perfil)
--
-- Convención de seguridad (igual que competitor_posts / market_intelligence):
--   • FK a public.clients(id) on delete cascade
--   • RLS: staff interno (is_internal_staff) full access + cliente CRUD sobre
--     sus propias filas (client_id = su profiles.client_id) + service_role full.
--
-- Seguro de correr varias veces (if not exists / drop policy if exists).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Trigger genérico para updated_at ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) content_ideas  — Ideas de contenido (IG + YT)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.content_ideas (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  channel     text not null check (channel in ('instagram','youtube')),
  title       text not null,
  format      text,                       -- Reel/Carousel/Image (IG) | Short/Video largo (YT)
  hook        text,
  notes       text,
  status      text not null default 'idea' check (status in ('idea','in_progress','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists content_ideas_client_channel_idx
  on public.content_ideas (client_id, channel, created_at desc);

drop trigger if exists content_ideas_set_updated_at on public.content_ideas;
create trigger content_ideas_set_updated_at
  before update on public.content_ideas
  for each row execute function public.set_updated_at();

alter table public.content_ideas enable row level security;

drop policy if exists "service_role_all" on public.content_ideas;
create policy "service_role_all" on public.content_ideas
  for all to service_role using (true) with check (true);

drop policy if exists "internal_all" on public.content_ideas;
create policy "internal_all" on public.content_ideas
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists "client_own" on public.content_ideas;
create policy "client_own" on public.content_ideas
  for all to authenticated
  using (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()))
  with check (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 2) content_competitors  — Competidores guardados (IG + YT)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.content_competitors (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  channel     text not null check (channel in ('instagram','youtube')),
  handle      text,                       -- @handle o nombre del canal
  url         text,
  name        text,
  avatar_url  text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists content_competitors_client_channel_idx
  on public.content_competitors (client_id, channel, created_at desc);

alter table public.content_competitors enable row level security;

drop policy if exists "service_role_all" on public.content_competitors;
create policy "service_role_all" on public.content_competitors
  for all to service_role using (true) with check (true);

drop policy if exists "internal_all" on public.content_competitors;
create policy "internal_all" on public.content_competitors
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists "client_own" on public.content_competitors;
create policy "client_own" on public.content_competitors
  for all to authenticated
  using (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()))
  with check (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 3) content_vault  — Reels/videos guardados como base de datos (IG + YT)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.content_vault (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  channel     text not null check (channel in ('instagram','youtube')),
  url         text not null,
  title       text,
  thumbnail   text,
  notes       text,
  favorite    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists content_vault_client_channel_idx
  on public.content_vault (client_id, channel, created_at desc);

alter table public.content_vault enable row level security;

drop policy if exists "service_role_all" on public.content_vault;
create policy "service_role_all" on public.content_vault
  for all to service_role using (true) with check (true);

drop policy if exists "internal_all" on public.content_vault;
create policy "internal_all" on public.content_vault
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists "client_own" on public.content_vault;
create policy "client_own" on public.content_vault
  for all to authenticated
  using (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()))
  with check (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 4) client_context  — Context Room (1 fila por cliente, blob jsonb)
-- ════════════════════════════════════════════════════════════════════════════
-- Guarda el objeto completo del Context Room (los 7 tabs). El front maneja
-- un Record<string,string> con arrays serializados; lo persistimos como jsonb.
create table if not exists public.client_context (
  client_id   uuid primary key references public.clients(id) on delete cascade,
  context     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists client_context_set_updated_at on public.client_context;
create trigger client_context_set_updated_at
  before update on public.client_context
  for each row execute function public.set_updated_at();

alter table public.client_context enable row level security;

drop policy if exists "service_role_all" on public.client_context;
create policy "service_role_all" on public.client_context
  for all to service_role using (true) with check (true);

drop policy if exists "internal_all" on public.client_context;
create policy "internal_all" on public.client_context
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

drop policy if exists "client_own" on public.client_context;
create policy "client_own" on public.client_context
  for all to authenticated
  using (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()))
  with check (client_id in (select p.client_id from public.profiles p where p.id = auth.uid()));

-- ── Refrescar el schema cache de PostgREST ──────────────────────────────────
notify pgrst, 'reload schema';
