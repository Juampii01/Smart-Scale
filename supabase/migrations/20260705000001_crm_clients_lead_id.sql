-- Vínculo real entre un lead y el cliente en que se convierte. Hoy son cargas
-- separadas sin ninguna relación — esto permite cruzar señales de entrada del
-- lead (rating, fuente, nicho) con cómo terminó cerrando (Omni: análisis de
-- calidad de leads vs. resultados).
alter table public.crm_clients
  add column if not exists lead_id uuid references public.leads(id);

-- Backfill conservador (una sola vez): solo vincula si nombre Y instagram
-- coinciden — evita falsos positivos entre clientes/leads con nombres
-- parecidos. Los que no matcheen quedan lead_id = null (se pueden revisar
-- y vincular a mano después).
update public.crm_clients c
set lead_id = l.id
from public.leads l
where c.lead_id is null
  and lower(trim(c.name)) = lower(trim(l.name))
  and c.instagram is not null and l.instagram is not null
  and lower(replace(c.instagram, '@', '')) = lower(replace(l.instagram, '@', ''));
