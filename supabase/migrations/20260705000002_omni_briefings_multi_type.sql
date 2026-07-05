-- omni_daily_briefings solo permitía un briefing por día (unique(date)).
-- Ahora conviven dos tipos de análisis el mismo día: 'community' (Slack, ya
-- existente) y 'leads' (calidad de leads vs. cómo cerraron, nuevo) — sin
-- pisarse entre sí.
alter table public.omni_daily_briefings
  add column if not exists type text not null default 'community';

alter table public.omni_daily_briefings
  drop constraint if exists omni_daily_briefings_date_key;

alter table public.omni_daily_briefings
  add constraint omni_daily_briefings_date_type_key unique (date, type);
