-- Omni — tablas para 3 features nuevas del piloto:
--   1. Token de usuario de Ann para leer Slack (reemplaza al bot para lectura)
--   2. Chat conversacional (memoria persistente, un solo hilo)
--   3. Briefing diario automático (guardado, no solo push efímero)
-- Mismo patrón de aislamiento que el resto de omni_*: RLS habilitada sin
-- policies, solo el service role accede.

-- Token de usuario de Ann (Slack OAuth v2, user_scope). Reemplaza SLACK_BOT_TOKEN
-- para lectura: hereda automáticamente los canales de los que Ann ya es
-- miembro (público + privado), sin invitar a un bot canal por canal.
create table if not exists public.omni_slack_user_connection (
  id             uuid primary key default gen_random_uuid(),
  slack_user_id  text not null,
  slack_team_id  text not null,
  access_token   text not null,
  scopes         text not null default '',
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (slack_user_id, slack_team_id)
);

-- Chat de Omni — un solo hilo persistente (Omni es de un solo usuario, no
-- hace falta el modelo multi-conversación de ann_conversations).
create table if not exists public.omni_conversations (
  id          uuid primary key default gen_random_uuid(),
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Briefing diario — resultado guardado del análisis automático (cron), para
-- que quede visible en la UI además del push.
create table if not exists public.omni_daily_briefings (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null default current_date,
  findings            jsonb not null default '[]'::jsonb,
  messages_analyzed   integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (date)
);

alter table public.omni_slack_user_connection enable row level security;
alter table public.omni_conversations          enable row level security;
alter table public.omni_daily_briefings        enable row level security;
