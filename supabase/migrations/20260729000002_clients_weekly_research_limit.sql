-- Override del límite semanal de análisis de competidores (content-research)
-- por cliente. NULL = usa el default (3) del código.

alter table clients add column if not exists weekly_research_limit integer;
comment on column clients.weekly_research_limit is 'Override del límite semanal de análisis de competidores (content-research). NULL = usa el default (3).';
