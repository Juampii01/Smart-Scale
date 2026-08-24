-- "Hoy" (Fase 2) necesita saber CUÁNDO se marcó "llamada agendada" para
-- poder mostrar "llamadas agendadas este mes" en el panel "Tu mes, hasta
-- ahora" — call_tag por sí solo no tiene fecha. Aditivo, nullable, no
-- rompe nada de lo ya construido en la Fase 1.
alter table public.client_crm_prospects add column if not exists call_tagged_at timestamptz;

notify pgrst, 'reload schema';
