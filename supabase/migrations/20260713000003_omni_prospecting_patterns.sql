-- Corpus estructurado de patrones de prospección (situación → enfoque
-- usado → resultado), cargado por Steffano vía el botón "Corregir" en cada
-- análisis de conversación, o suelto desde el apartado "Prospección".
-- Append-only por diseño: se acumula un historial reusable a futuro, nunca
-- se pisa una fila existente salvo para actualizar resultado/corrección de
-- un caso que quedó "pendiente".
create table if not exists public.omni_prospecting_patterns (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid references public.omni_conversations(id) on delete set null,
  participant_username text,
  situacion            text not null,
  enfoque              text not null,
  resultado            text not null default 'pendiente'
                       check (resultado in ('cerro','no_cerro','pendiente')),
  correccion           text,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_omni_prospecting_patterns_conversation
  on public.omni_prospecting_patterns (conversation_id);
create index if not exists idx_omni_prospecting_patterns_created_at
  on public.omni_prospecting_patterns (created_at desc);

alter table public.omni_prospecting_patterns enable row level security;
create policy "service_role_all" on public.omni_prospecting_patterns
  for all to service_role using (true) with check (true);
