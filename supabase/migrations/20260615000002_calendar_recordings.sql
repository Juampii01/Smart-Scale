-- ════════════════════════════════════════════════════════════════════════════
-- calendar_recordings — grabaciones de las sesiones (llega vía webhook de Zapier)
-- ════════════════════════════════════════════════════════════════════════════
-- Las graba Zapier cuando Zoom termina de procesar la grabación y las publica
-- en la pestaña "Grabaciones" de la Agenda. Son globales (todos los clientes
-- ven las grabaciones de las masterclass), igual que calendar_events.
--
-- Seguro de correr varias veces.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.calendar_recordings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  recorded_at   date not null default current_date,
  recording_url text not null,
  passcode      text,
  duration      text,
  playbook_url  text,
  thumbnail     text,
  notes         text,
  source        text,                       -- ej: 'zoom' / 'zapier'
  created_at    timestamptz not null default now()
);

create index if not exists calendar_recordings_recorded_at_idx
  on public.calendar_recordings (recorded_at desc);

alter table public.calendar_recordings enable row level security;

-- service_role (webhook + admin) full
drop policy if exists "service_role_all" on public.calendar_recordings;
create policy "service_role_all" on public.calendar_recordings
  for all to service_role using (true) with check (true);

-- cualquier usuario autenticado puede ver las grabaciones (clientes incluidos)
drop policy if exists "authenticated_read" on public.calendar_recordings;
create policy "authenticated_read" on public.calendar_recordings
  for select to authenticated using (true);

notify pgrst, 'reload schema';
