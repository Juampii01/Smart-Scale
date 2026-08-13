-- ════════════════════════════════════════════════════════════════════════════
-- team_member_context — Context Room interno, solo para miembros del equipo
-- (admin/team/setter). A diferencia de client_context, NO habla de negocio:
-- son preguntas personales (historia, familia, energía, qué los drena/enciende).
--
-- Visibilidad (a pedido explícito, distinta de client_context):
--   • admin puede ver y editar el de cualquier miembro del equipo.
--   • team/setter solo pueden ver y editar el propio.
--   • service_role full access.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.team_member_context (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  context     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists team_member_context_set_updated_at on public.team_member_context;
create trigger team_member_context_set_updated_at
  before update on public.team_member_context
  for each row execute function public.set_updated_at();

alter table public.team_member_context enable row level security;

drop policy if exists "service_role_all" on public.team_member_context;
create policy "service_role_all" on public.team_member_context
  for all to service_role using (true) with check (true);

drop policy if exists "admin_all" on public.team_member_context;
create policy "admin_all" on public.team_member_context
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "own_row" on public.team_member_context;
create policy "own_row" on public.team_member_context
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
