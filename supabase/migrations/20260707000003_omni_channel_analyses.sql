-- Análisis de UN canal de Slack a la vez, a demanda (botón "Analizar" por
-- canal en la pestaña Comunidad de /admin/omni) — mismo patrón que
-- omni_conversation_analyses para Instagram. No usa "irremontable": un
-- canal de comunidad no se "pierde" como un prospecto, así que el estado
-- es más simple (sano/en_riesgo).
create table if not exists public.omni_channel_analyses (
  channel_id  uuid primary key references public.omni_slack_channels(id) on delete cascade,
  estado      text not null check (estado in ('sano','en_riesgo')),
  situacion   text,
  principio   text,
  evidencia   text,
  accion      text,
  severidad   text check (severidad in ('alta','media','baja')),
  analyzed_at timestamptz not null default now()
);

alter table public.omni_channel_analyses enable row level security;

notify pgrst, 'reload schema';
