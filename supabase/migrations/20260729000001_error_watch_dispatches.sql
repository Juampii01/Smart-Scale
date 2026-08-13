-- error_watch_dispatches: dedupe de errores/warnings nuevos que ya se le
-- mandaron al agente Constructor para diagnóstico automático (solo lectura,
-- nunca aplica fixes solo — ver app/api/cron/error-watch/route.ts).

create table if not exists error_watch_dispatches (
  id            uuid primary key default gen_random_uuid(),
  signature     text not null unique,   -- hash de route + mensaje normalizado (sin ids/timestamps)
  route         text,
  sample_message text not null,
  first_seen_at timestamptz not null,
  status        text not null default 'pending' check (status in ('pending', 'diagnosing', 'diagnosed', 'failed')),
  session_id    text,                   -- Managed Agents session id
  diagnosis     text,                   -- reporte final del agente, una vez listo
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists error_watch_dispatches_status_idx on error_watch_dispatches (status);

alter table error_watch_dispatches enable row level security;
-- sin policies: solo lo usa el service role, mismo patrón que system_job_runs.
