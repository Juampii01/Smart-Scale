-- CRM interno del cliente (prompt-crm.md, Fase 1 · datos).
--
-- Tablas nuevas, propias del CRM — no se toca clients/profiles salvo por el
-- interruptor de encendido (crm_enabled), ni ninguna tabla que ya funciona.
--
-- Nombrado client_crm_* a propósito, para no confundir con:
--   - crm_clients / crm_installments / crm_followups: el CRM de VENTAS de
--     Smart Scale (sus propios clientes), tabla completamente distinta.
--   - client_prospects: tabla ya existente para prospección interna
--     (setter/admin trabajando bajo el internal_tenant_id de un cliente),
--     construida para otro caso de uso (staff prospectando EN NOMBRE del
--     cliente) y todavía sin lanzar (nav oculto). El CRM de este prompt es
--     el propio cliente cargando y trabajando SU pipeline desde su portal
--     — mismo shape superficial, dueño distinto. Se mantienen separadas.
--
-- Permisos (ver prompt-crm.md → "Permisos"): el cliente ve y edita solo lo
-- suyo. El equipo de Smart Scale entra en SOLO LECTURA, sin excepciones —
-- ni siquiera el platform owner tiene bypass de escritura acá (a
-- diferencia de is_platform_owner() en otras tablas). Eso se garantiza acá
-- abajo, en la base, no en la pantalla.

-- ── Interruptor por cliente (Reglas de despliegue #1) ───────────────────────
-- Nada aparece en el menú de un cliente hasta que esté prendido para su
-- cuenta. El código puede estar en producción antes de que nadie lo vea.
alter table public.clients add column if not exists crm_enabled boolean not null default false;

-- ── Helper de RLS: "¿el que pide esto es el dueño de esta cuenta?" ──────────
-- Deliberadamente NO incluye is_internal_staff() ni is_platform_owner() —
-- esas dos se agregan aparte, solo en las policies de SELECT.
create or replace function public.is_crm_owner_client(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = 'public', 'pg_catalog'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'client'
      and p.client_id = target_client_id
  );
$$;
revoke execute on function public.is_crm_owner_client(uuid) from anon, public;
grant execute on function public.is_crm_owner_client(uuid) to authenticated;

-- ── prospectos ───────────────────────────────────────────────────────────
-- Las 5 etapas no son inventadas — salen de los campos que Smart Scale ya
-- mide (Conversación → Calificado → OfferDoc enviado → OfferDoc respondido
-- → Cerrado). "Perdido" no es una etapa: es un archivado (decisión del
-- usuario) — el prospecto sale del tablero activo pero no se borra ni
-- pierde su historial, se recupera desde el filtro de perdidos.
create table public.client_crm_prospects (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  name               text not null,
  handle             text,
  estimated_value    numeric,
  stage              text not null default 'conversacion'
                       check (stage in ('conversacion', 'calificado', 'offerdoc_enviado', 'offerdoc_respondido', 'cerrado')),
  call_tag           text check (call_tag in ('llamada_agendada', 'llamada_asistida')),
  source             text,
  notes              text,
  archived_at        timestamptz,
  last_movement_at   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index client_crm_prospects_client_id_idx on public.client_crm_prospects (client_id);
create index client_crm_prospects_stage_idx on public.client_crm_prospects (client_id, stage) where archived_at is null;

alter table public.client_crm_prospects enable row level security;

create policy "service_role_all" on public.client_crm_prospects
  for all to service_role using (true) with check (true);

create policy "client_crm_prospects_select" on public.client_crm_prospects
  for select to authenticated
  using (is_crm_owner_client(client_id) or public.is_internal_staff() or public.is_platform_owner());

create policy "client_crm_prospects_insert" on public.client_crm_prospects
  for insert to authenticated
  with check (is_crm_owner_client(client_id));

create policy "client_crm_prospects_update" on public.client_crm_prospects
  for update to authenticated
  using (is_crm_owner_client(client_id))
  with check (is_crm_owner_client(client_id));

create policy "client_crm_prospects_delete" on public.client_crm_prospects
  for delete to authenticated
  using (is_crm_owner_client(client_id));

-- ── movimientos ──────────────────────────────────────────────────────────
-- Cada cambio de etapa, con fecha — de acá sale "hace 11 días que no se
-- mueve" sin tener que inventarlo. client_id duplicado a propósito (mismo
-- patrón que lead_updates) para que la policy no dependa de un join.
create table public.client_crm_movements (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.client_crm_prospects(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  from_stage   text,
  to_stage     text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index client_crm_movements_prospect_id_idx on public.client_crm_movements (prospect_id, created_at desc);
create index client_crm_movements_client_id_idx on public.client_crm_movements (client_id);

alter table public.client_crm_movements enable row level security;

create policy "service_role_all" on public.client_crm_movements
  for all to service_role using (true) with check (true);

create policy "client_crm_movements_select" on public.client_crm_movements
  for select to authenticated
  using (is_crm_owner_client(client_id) or public.is_internal_staff() or public.is_platform_owner());

create policy "client_crm_movements_insert" on public.client_crm_movements
  for insert to authenticated
  with check (is_crm_owner_client(client_id));

-- Movimientos es bitácora append-only — sin policy de update/delete para
-- authenticated (ni siquiera el propio cliente edita su historial).

-- ── conversaciones ───────────────────────────────────────────────────────
-- Registro por prospecto — mismo patrón append-only que movimientos.
create table public.client_crm_conversations (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.client_crm_prospects(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  note         text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index client_crm_conversations_prospect_id_idx on public.client_crm_conversations (prospect_id, created_at desc);
create index client_crm_conversations_client_id_idx on public.client_crm_conversations (client_id);

alter table public.client_crm_conversations enable row level security;

create policy "service_role_all" on public.client_crm_conversations
  for all to service_role using (true) with check (true);

create policy "client_crm_conversations_select" on public.client_crm_conversations
  for select to authenticated
  using (is_crm_owner_client(client_id) or public.is_internal_staff() or public.is_platform_owner());

create policy "client_crm_conversations_insert" on public.client_crm_conversations
  for insert to authenticated
  with check (is_crm_owner_client(client_id));

-- ── tareas ───────────────────────────────────────────────────────────────
-- Las del panel interno del cliente (sector "Operación"). prospect_id
-- nullable — una tarea puede no estar atada a un prospecto puntual.
create table public.client_crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  prospect_id  uuid references public.client_crm_prospects(id) on delete set null,
  title        text not null,
  done         boolean not null default false,
  due_at       date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index client_crm_tasks_client_id_idx on public.client_crm_tasks (client_id);

alter table public.client_crm_tasks enable row level security;

create policy "service_role_all" on public.client_crm_tasks
  for all to service_role using (true) with check (true);

create policy "client_crm_tasks_select" on public.client_crm_tasks
  for select to authenticated
  using (is_crm_owner_client(client_id) or public.is_internal_staff() or public.is_platform_owner());

create policy "client_crm_tasks_insert" on public.client_crm_tasks
  for insert to authenticated
  with check (is_crm_owner_client(client_id));

create policy "client_crm_tasks_update" on public.client_crm_tasks
  for update to authenticated
  using (is_crm_owner_client(client_id))
  with check (is_crm_owner_client(client_id));

create policy "client_crm_tasks_delete" on public.client_crm_tasks
  for delete to authenticated
  using (is_crm_owner_client(client_id));

notify pgrst, 'reload schema';
