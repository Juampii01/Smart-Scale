-- Permite desactivar una cuenta (cliente, setter, team, admin) sin borrarla:
-- se mantienen el profile y todos sus datos relacionados, pero el usuario no
-- puede volver a loguearse (chequeado en app/login/page.tsx y
-- components/layout/dashboard-layout.tsx) y queda agrupado aparte ("Off") en
-- el selector "Cambiar perfil" del header de admin.
alter table public.profiles
  add column if not exists active boolean not null default true;

create index if not exists idx_profiles_active on public.profiles (active);
