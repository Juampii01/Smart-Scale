-- Omni — piloto interno con Ann. Tablas y flujo 100% aislados del resto del
-- portal: no comparten fila con `social_connections` (clientes normales) ni con
-- `oauth_states` (flujo OAuth compartido). Así, pedirle a Ann el permiso extra
-- de leer DMs de Instagram nunca amplía lo que se le pide a un cliente comun.
-- RLS habilitada sin policies => solo el service role accede (mismo patrón que
-- social_connections).

-- CSRF state efímero del connect de Instagram de Omni (single-use, TTL 10 min).
create table if not exists public.omni_oauth_states (
  state       text primary key,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_omni_oauth_states_expires on public.omni_oauth_states(expires_at);

-- Conexión de Instagram de Omni: una sola cuenta (la de Ann). Token cifrado
-- con el mismo helper que social_connections (lib/social/crypto), pide scope
-- adicional (instagram_business_manage_messages) que NO se pide a clientes.
create table if not exists public.omni_instagram_connections (
  id            uuid primary key default gen_random_uuid(),
  account_id    text not null unique,
  account_name  text not null,
  account_pic   text,
  access_token  text not null,
  expires_at    timestamptz,
  scopes        text not null default '',
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.omni_conversations (
  id                    uuid primary key default gen_random_uuid(),
  ig_conversation_id    text not null unique,
  participant_username  text,
  participant_ig_id     text,
  last_message_at       timestamptz,
  last_message_from     text check (last_message_from in ('lead','ann')),
  synced_at             timestamptz not null default now()
);

create table if not exists public.omni_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.omni_conversations(id) on delete cascade,
  ig_message_id   text not null unique,
  sender          text not null check (sender in ('lead','ann')),
  body            text,
  sent_at         timestamptz,
  synced_at       timestamptz not null default now()
);

create index if not exists idx_omni_messages_conversation on public.omni_messages(conversation_id);

-- Slack: mismo bot/workspace ya conectado (SLACK_BOT_TOKEN), solo se le agregan
-- scopes de lectura. Incluye los canales #cl-nombre (1:1 por cliente) además
-- de los canales compartidos de comunidad.
create table if not exists public.omni_slack_channels (
  id                uuid primary key default gen_random_uuid(),
  slack_channel_id  text not null unique,
  name              text not null,
  is_client_channel boolean not null default false,
  client_id         uuid references public.clients(id) on delete set null,
  synced_at         timestamptz not null default now()
);

create table if not exists public.omni_slack_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.omni_slack_channels(id) on delete cascade,
  slack_ts    text not null,
  user_name   text,
  body        text,
  posted_at   timestamptz,
  synced_at   timestamptz not null default now(),
  unique (channel_id, slack_ts)
);

create index if not exists idx_omni_slack_messages_channel on public.omni_slack_messages(channel_id);

alter table public.omni_oauth_states          enable row level security;
alter table public.omni_instagram_connections enable row level security;
alter table public.omni_conversations         enable row level security;
alter table public.omni_messages              enable row level security;
alter table public.omni_slack_channels        enable row level security;
alter table public.omni_slack_messages        enable row level security;
