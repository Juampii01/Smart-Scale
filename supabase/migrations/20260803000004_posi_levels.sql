-- "Posi" — formularios de evaluación por nivel (8 niveles). El cliente
-- responde y necesita el % de passing_score para aprobar y destrabar el
-- siguiente nivel. Contenido placeholder — Ann carga las preguntas reales
-- después desde /admin/posi-levels.

create table if not exists posi_levels (
  id            uuid primary key default gen_random_uuid(),
  level_number  integer not null unique,
  title         text not null,
  description   text,
  -- questions: [{ id, text, type: "multiple_choice" | "open", options?: string[], correct_index?: number }]
  questions     jsonb not null default '[]'::jsonb,
  passing_score integer not null default 80,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists client_posi_submissions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  level_id      uuid not null references posi_levels(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,   -- { question_id: answer }
  score         integer,                              -- % sobre preguntas multiple_choice
  passed        boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (client_id, level_id)
);

alter table posi_levels enable row level security;
alter table client_posi_submissions enable row level security;

drop policy if exists "service_role_all" on posi_levels;
create policy "service_role_all" on posi_levels for all to service_role using (true) with check (true);

drop policy if exists "service_role_all" on client_posi_submissions;
create policy "service_role_all" on client_posi_submissions for all to service_role using (true) with check (true);

-- Seed: 8 niveles placeholder, cada uno con 1 pregunta de ejemplo editable.
insert into posi_levels (level_number, title, description, questions, passing_score)
select n, 'Nivel ' || n, 'Descripción pendiente — editar desde /admin/posi-levels.',
  jsonb_build_array(jsonb_build_object(
    'id', 'q1',
    'text', 'Pregunta placeholder del Nivel ' || n || ' — reemplazar.',
    'type', 'multiple_choice',
    'options', jsonb_build_array('Opción A', 'Opción B', 'Opción C'),
    'correct_index', 0
  )),
  80
from generate_series(1, 8) as n
where not exists (select 1 from posi_levels where level_number = n);

notify pgrst, 'reload schema';
