-- El backfill conservador (nombre + instagram) de 20260705000001 encontró 0
-- vínculos: crm_clients.instagram está vacío en casi todos los clientes (se
-- sacó del formulario de onboarding en algún momento). Bajando el criterio a
-- solo nombre exacto aparece 1 único match verosímil (fecha del lead anterior
-- a la del cliente, mismo nombre completo) — se vincula a mano ese caso
-- puntual. El resto del histórico queda sin vincular; de acá en más el
-- selector de "lead de origen" en el onboarding evita que este hueco crezca.
update public.crm_clients c
set lead_id = l.id
from public.leads l
where c.lead_id is null
  and lower(trim(c.name)) = lower(trim(l.name))
  and c.name = 'Gaston Aldana';
