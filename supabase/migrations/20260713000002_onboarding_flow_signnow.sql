-- Migra el tracking del contrato de GHL a SignNow. ghl_contact_id queda como
-- dato histórico inerte (clientes onboardeados antes del switch) — no se
-- borra ni se migra su valor.
alter table public.onboarding_flow
  add column if not exists signnow_document_id text;

create index if not exists idx_onboarding_flow_signnow_doc
  on public.onboarding_flow(signnow_document_id);

-- Log crudo de cada webhook de SignNow — mismo patrón que ghl_webhook_events.
-- El payload real no está 100% confirmado por la doc pública, se ajusta con
-- el primer evento real (mismo proceso que se hizo con GHL en su momento).
create table if not exists public.signnow_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  raw_payload    jsonb not null,
  matched_client uuid references public.crm_clients(id) on delete set null,
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_signnow_webhook_events_created
  on public.signnow_webhook_events(created_at desc);

alter table public.signnow_webhook_events enable row level security;
