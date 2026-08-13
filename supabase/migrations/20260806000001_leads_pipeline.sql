-- Pipeline de leads (Kanban): fecha de próximo seguimiento + valor estimado.
-- La etapa del pipeline reusa la columna "status" existente (antes texto libre
-- sin uso real: los 105 leads previos estaban todos en "nuevo"). Valores nuevos:
-- 'calificado' | 'conversacion' | 'oferta' | 'compraron' | 'perdido'.
-- No hace falta backfill: un lead sin status de pipeline pero con rating >= 4
-- se trata como "calificado" en el frontend (ver components/leads-pipeline).

alter table public.leads
  add column if not exists next_follow_up_at date,
  add column if not exists deal_value numeric;
