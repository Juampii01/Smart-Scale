-- Encuesta de "Sistema Operativo" que llena la founder (Ann) desde el sector
-- Founder del admin — reemplaza la idea de que ella escriba markdown a mano
-- (business.md/marketing.md/delivery.md): responde una encuesta de opción
-- múltiple + texto libre, una fila por sección.
create table if not exists public.founder_operating_system (
  id            uuid primary key default gen_random_uuid(),
  section       text not null unique check (section in ('negocio', 'marketing', 'entrega')),
  answers       jsonb not null default '{}'::jsonb,  -- { [question_key]: string | string[] }
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);

alter table public.founder_operating_system enable row level security;

create policy "service_role_all" on public.founder_operating_system
  for all to service_role using (true) with check (true);
