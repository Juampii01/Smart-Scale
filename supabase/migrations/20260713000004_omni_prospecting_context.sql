-- Contexto de prospección propio de Steffano (apartado "Prospección" en Ann
-- AI), separado del "Cerebro de Ann" (ann_knowledge). Tabla singleton (una
-- sola fila, mismo patrón de PK textual que omni_client_profiles) — texto
-- libre, editable por cualquiera con acceso a Ann AI (Steffano/Ann/dueño).
create table if not exists public.omni_prospecting_context (
  context_id        text primary key default 'prospeccion',
  workflow_inbound  text not null default '',
  workflow_outbound text not null default '',
  notas_generales   text not null default '',
  updated_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.omni_prospecting_context enable row level security;
create policy "service_role_all" on public.omni_prospecting_context
  for all to service_role using (true) with check (true);
