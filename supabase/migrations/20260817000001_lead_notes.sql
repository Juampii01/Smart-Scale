-- "Algo acerca del lead" era un textarea que sobreescribía todo cada vez que
-- se guardaba — pedido: que sea un log de notas que se van acumulando (quién
-- la escribió, cuándo), no texto libre que se pisa. `leads.notes` se deja
-- como está y pasa a ser un espejo liviano de la nota más reciente (para que
-- el export a CSV y la creación de leads no se rompan) — el historial
-- completo vive acá.

create table public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  author     text,
  body       text not null,
  created_at timestamptz not null default now()
);

create index lead_notes_lead_id_idx on public.lead_notes(lead_id);

alter table public.lead_notes enable row level security;

create policy "service_role_all" on public.lead_notes
  for all to service_role using (true) with check (true);

-- Backfill: cada lead con `notes` no vacío se convierte en la primera
-- entrada de su historial, con la fecha de creación del lead (mejor
-- aproximación disponible — no sabemos cuándo se escribió esa nota).
insert into public.lead_notes (lead_id, body, created_at)
select id, notes, created_at
from public.leads
where notes is not null and trim(notes) <> '';
