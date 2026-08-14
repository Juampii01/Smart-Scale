-- "Situación del lead" — bitácora append-only de actualizaciones por lead
-- (reemplaza el textarea único "Algo acerca del lead" por un historial de
-- entradas con fecha, tipo timeline). Mismo patrón multi-tenant que leads.
--
-- leads.notes se mantiene intacto (no se dropea): lo siguen leyendo
-- lib/omni/lead-outcome-analysis.ts y lib/omni/prospecting-risk-analysis.ts
-- para el análisis con IA. El endpoint que crea una entrada nueva también
-- sincroniza leads.notes = última nota, así esos consumidores no quedan
-- desactualizados sin tener que reescribirlos.

create table public.lead_updates (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  client_id   uuid not null references public.clients(id),
  note        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index lead_updates_lead_id_idx   on public.lead_updates (lead_id, created_at desc);
create index lead_updates_client_id_idx on public.lead_updates (client_id);

alter table public.lead_updates enable row level security;

create policy "service_role_all" on public.lead_updates
  for all to service_role using (true) with check (true);

create policy "lead_updates_tenant_access" on public.lead_updates
  for all to authenticated
  using (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_platform_owner()
    or client_id = (select p.internal_tenant_id from public.profiles p where p.id = (select auth.uid()))
  );

-- Backfill: la nota existente de cada lead pasa a ser su primera entrada del
-- historial, así no se pierde nada de lo ya cargado.
insert into public.lead_updates (lead_id, client_id, note, created_at)
select id, client_id, notes, updated_at
from public.leads
where notes is not null and length(trim(notes)) > 0;

notify pgrst, 'reload schema';
