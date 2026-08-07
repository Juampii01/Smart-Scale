-- Llamadas de clientes recibidas desde Zoom vía Zapier. client_id apunta a
-- crm_clients (mismo uuid que clients/portal, ver CLAUDE.md gotcha #1) — se
-- matchea por email del participante en el webhook, queda null ("sin
-- asignar") si no matchea a nadie, para asignar a mano sin perder el dato.
create table if not exists public.client_calls (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references public.crm_clients(id) on delete set null,
  participant_email  text,
  participant_name   text,
  recording_url      text,
  transcript         text,
  meeting_topic      text,
  duration_minutes   numeric,
  occurred_at        timestamptz not null default now(),
  raw_payload        jsonb,
  matched_at         timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.client_calls enable row level security;
create policy "service_role_all" on public.client_calls for all to service_role using (true) with check (true);

create index if not exists client_calls_client_id_idx on public.client_calls (client_id, occurred_at desc);
create index if not exists client_calls_unassigned_idx on public.client_calls (occurred_at desc) where client_id is null;
