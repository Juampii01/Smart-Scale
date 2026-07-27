-- Registro genérico de corridas de crons/webhooks/notificadores, para el
-- panel "Estado del Sistema" en /admin/omni — hoy nada de esto se ve en
-- ningún lado salvo logs de Vercel. Solo el service role escribe/lee (mismo
-- patrón que omni_daily_briefings), no hace falta política de RLS por rol.
create table if not exists public.system_job_runs (
  id         uuid primary key default gen_random_uuid(),
  job_name   text not null,
  status     text not null check (status in ('ok', 'error')),
  detail     text,
  ran_at     timestamptz not null default now()
);

create index if not exists system_job_runs_job_name_ran_at_idx
  on public.system_job_runs (job_name, ran_at desc);

alter table public.system_job_runs enable row level security;
