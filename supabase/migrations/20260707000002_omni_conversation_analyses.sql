-- Análisis de UNA conversación de Instagram a la vez, a demanda (botón
-- "Analizar" por conversación en /admin/omni) — distinto del análisis en
-- bloque de prospecting-risk-analysis.ts, que solo devuelve las que están
-- en riesgo. Acá SIEMPRE hay un veredicto, incluyendo 'sano', porque el
-- usuario pidió analizar ESTA conversación puntual.
create table if not exists public.omni_conversation_analyses (
  conversation_id uuid primary key references public.omni_conversations(id) on delete cascade,
  estado      text not null check (estado in ('sano','en_riesgo','irremontable')),
  situacion   text,
  principio   text,
  evidencia   text,
  accion      text,
  severidad   text check (severidad in ('alta','media','baja')),
  analyzed_at timestamptz not null default now()
);

alter table public.omni_conversation_analyses enable row level security;

notify pgrst, 'reload schema';
