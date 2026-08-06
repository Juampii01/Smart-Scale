-- Orden manual dentro de cada columna del pipeline de leads (drag&drop libre,
-- no solo la fecha de seguimiento). Null = todavía no se reordenó a mano.
alter table public.leads add column if not exists pipeline_order integer;
