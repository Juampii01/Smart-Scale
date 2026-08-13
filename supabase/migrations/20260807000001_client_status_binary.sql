-- Simplifica el status de crm_clients a solo 2 valores: activo / offboarding.
-- Antes había 4 (activo, en_pausa, inactivo, completado) — generaban confusión
-- sobre cuál usar. Todo lo que no es "activo" pasa a ser "offboarding".
update public.crm_clients
set status = 'offboarding'
where status in ('en_pausa', 'inactivo', 'completado');
