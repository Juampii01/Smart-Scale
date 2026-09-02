-- Destrabe automático del curso siguiente en Skool al aprobar un nivel POSI.
-- Skool solo permite destrabar un CURSO PRIVADO entero, identificando al
-- miembro por email — de ahí las dos columnas nuevas y la tabla de eventos.

-- Curso privado de Skool que corresponde a cada nivel. Se destraba cuando el
-- cliente aprueba el nivel ANTERIOR. Texto libre: es el nombre exacto del
-- curso tal como figura en el classroom, que es lo que mapea la acción de Zapier.
alter table public.posi_levels
  add column if not exists skool_course_name text;

-- Email con el que Skool identifica al miembro. `clients` (la tabla del
-- portal) no tenía ninguna columna de email hasta ahora — ni `clients` ni
-- `profiles` la tienen, el email solo vive en `auth.users`. En vez de
-- resolverlo en cada request (ambiguo si un cliente tiene más de una cuenta
-- de portal, y suma una llamada a la Admin API en el camino sincrónico del
-- POST de submissions), lo pre-cargamos acá una sola vez:
alter table public.clients
  add column if not exists skool_email text;

-- Backfill: default = el email de auth.users de la cuenta de portal (role
-- 'client') vinculada a cada fila de clients. A partir de ahora, el mismo
-- alta se hace en caliente en app/api/admin/users/create/route.ts para cada
-- cliente nuevo. Si el email de Skool de un cliente es distinto al del
-- portal, Ann lo pisa a mano desde /admin/clients — ver skool_email de acá
-- en adelante como la fuente de verdad, nunca un fallback en tiempo real.
-- order by p.id + limit 1 es solo para resolver determinísticamente el caso
-- raro de más de un profile 'client' con el mismo client_id — no hay una
-- noción de "cuál es el principal", así que se toma cualquiera de forma
-- estable en vez de dejarlo en manos del orden no garantizado de un JOIN.
update public.clients c
set skool_email = (
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.client_id = c.id and p.role = 'client' and u.email is not null
  order by p.id
  limit 1
)
where c.skool_email is null;

-- Rastro de cada intento de destrabe — no hay API de lectura de Skool, así
-- que esto es lo único con lo que Ann va a poder ver qué pasó. Cada
-- aprobación (real o auto-aprobada al 3er intento) genera una fila acá,
-- sea que el destrabe se haya disparado, salteado o fallado.
create table if not exists public.posi_unlock_events (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  submission_id      uuid references public.client_posi_submissions(id) on delete set null,
  approved_level_id  uuid not null references public.posi_levels(id) on delete cascade,
  unlock_level_id    uuid references public.posi_levels(id) on delete set null,
  skool_course_name  text,
  skool_email        text,
  status             text not null default 'pending',  -- pending | sent | failed | skipped
  reason             text,                              -- por qué falló o se salteó
  auto_approved      boolean not null default false,
  payload            jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Idempotencia + protección de carrera: un mismo cliente no puede tener dos
-- destrabes vivos del mismo curso. Los 'failed' quedan fuera del índice a
-- propósito, para poder reintentar. El insert de la fila 'pending' es el
-- claim en sí (ver claim() en app/api/cron/call-reminders/route.ts, mismo
-- patrón) — si viola este índice, ya había un destrabe pending/sent en
-- curso para ese (cliente, nivel).
create unique index if not exists posi_unlock_events_client_level_live_idx
  on public.posi_unlock_events(client_id, unlock_level_id)
  where status in ('pending', 'sent');

create index if not exists posi_unlock_events_status_idx
  on public.posi_unlock_events(status, created_at desc);

alter table public.posi_unlock_events enable row level security;

drop policy if exists "service_role_all" on public.posi_unlock_events;
create policy "service_role_all" on public.posi_unlock_events
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
