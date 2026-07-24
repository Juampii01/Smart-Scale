-- Log crudo de cada webhook de pago recibido de PayFunnels — mismo patrón que
-- signnow_webhook_events. Se inserta ANTES de cualquier procesamiento, para
-- nunca perder el pago aunque el resto del flujo (mapeo de monto, creación de
-- cliente) falle.
create table if not exists public.payfunnels_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  raw_payload    jsonb not null,
  matched_client uuid references public.crm_clients(id) on delete set null,
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now()
);

alter table public.payfunnels_webhook_events enable row level security;

create policy "service_role_all" on public.payfunnels_webhook_events
  for all to service_role using (true) with check (true);

create index if not exists idx_payfunnels_webhook_events_created_at
  on public.payfunnels_webhook_events (created_at desc);
