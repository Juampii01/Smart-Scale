-- ============================================================================
-- Team applications (formularios de contratación)
-- ============================================================================
-- Una sola tabla para todos los roles. Los campos comunes (nombre, email,
-- whatsapp, instagram, role) van en columnas. Los campos específicos del
-- rol van en `answers` (JSONB) — para agregar un puesto nuevo no hace falta
-- migración, solo editar lib/team-application-forms.ts.

create table if not exists team_applications (
  id               uuid primary key default gen_random_uuid(),
  role             text not null,                    -- "setter", "closer", etc.
  first_name       text,
  last_name        text,
  email            text,
  whatsapp         text,
  instagram_handle text,
  answers          jsonb not null default '{}'::jsonb,
  status           text not null default 'nueva',    -- nueva | revisando | descartada | aprobada | contratada
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists team_applications_role_created_at_idx
  on team_applications (role, created_at desc);

create index if not exists team_applications_status_idx
  on team_applications (status);

alter table team_applications enable row level security;

-- Solo service_role puede leer/escribir (la API de admin usa service client).
drop policy if exists "service_role_all" on team_applications;
create policy "service_role_all"
  on team_applications
  for all
  to service_role
  using (true)
  with check (true);
