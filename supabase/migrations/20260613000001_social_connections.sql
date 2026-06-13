-- Conexiones sociales (Instagram / YouTube) — Fase 4
-- Guarda los tokens OAuth (cifrados en reposo vía lib/social/crypto) y el estado
-- CSRF del flujo de autorización. RLS bloqueada: solo el service role accede.

create table if not exists public.social_connections (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null,
  created_by    uuid,
  updated_by    uuid,
  platform      text not null check (platform in ('instagram','youtube')),
  account_id    text not null,
  account_name  text not null,
  account_pic   text,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  scopes        text not null default '',
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, platform)
);

create index if not exists idx_social_connections_client on public.social_connections(client_id);

-- Estado CSRF efímero del flujo OAuth (TTL ~10 min). Se borra al usarse.
create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null,
  client_id   uuid not null,
  platform    text not null,
  return_to   text not null default '/',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_oauth_states_expires on public.oauth_states(expires_at);

-- RLS habilitada SIN policies => acceso denegado para anon/authenticated.
-- Solo el service role (que bypassea RLS) lee/escribe estas tablas.
alter table public.social_connections enable row level security;
alter table public.oauth_states        enable row level security;
