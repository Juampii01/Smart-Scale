-- Paso 1 · Fundaciones del roadmap multi-tenant: cada cliente de Smart Scale
-- va a tener su propio pipeline de prospectos (su propia cartera), separado
-- del pipeline interno (public.leads, que es 100% flat/sin client_id).
--
-- Mismas columnas que public.leads (para reusar el motor de UI del Kanban
-- interno tal cual) + client_id.

create table public.client_prospects (
  id                      uuid        primary key default gen_random_uuid(),
  client_id               uuid        not null references public.clients(id) on delete cascade,
  name                    text,
  email                   text,
  tag                     text,
  source                  text,
  lead_type               text,
  status                  text        not null default 'nuevo',
  instagram               text,
  rating                  integer     check (rating between 1 and 5),
  niche                   text,
  notes                   text,
  purchased               boolean     not null default false,
  custom_fields           jsonb       not null default '{}',
  next_follow_up_at       date,
  follow_up_alert_sent_at timestamptz,
  deal_value              numeric,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index client_prospects_client_id_idx  on public.client_prospects (client_id);
create index client_prospects_created_at_idx on public.client_prospects (client_id, created_at desc);
create index client_prospects_status_idx     on public.client_prospects (client_id, status);

alter table public.client_prospects enable row level security;

-- Acceso primario: la ruta de API (app/api/client/prospects) usa
-- createServiceClient() + chequeo explícito de client_id en el handler,
-- mismo patrón que app/api/admin/leads y app/api/monthly-reports/save.
create policy "service_role_all" on public.client_prospects
  for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS de cinturón de seguridad, corrigiendo el anti-patrón encontrado en la
-- auditoría (2026-08-10): el resto de las tablas client-scoped en este repo
-- (client_context, content_ideas, monthly_reports, etc.) usan DOS policies
-- separadas por acción ("internal_all" + "client_own"), cada una evaluando
-- auth.uid() sin cachear — eso es lo que el advisor de Supabase marca como
-- "multiple_permissive_policies" (33 hits) + "auth_rls_initplan" (26 hits).
-- Acá va UNA sola policy por acción, con auth.uid() envuelto en (select ...)
-- para que Postgres lo cachee una vez por query en vez de por fila. Esta es
-- la plantilla a copiar para el resto de las tablas del multi-tenant.
-- ─────────────────────────────────────────────────────────────────────────
create policy "client_prospects_access" on public.client_prospects
  for all to authenticated
  using (
    public.is_internal_staff()
    or client_id = (select p.client_id from public.profiles p where p.id = (select auth.uid()))
  )
  with check (
    public.is_internal_staff()
    or client_id = (select p.client_id from public.profiles p where p.id = (select auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar manualmente después de aplicar, mismo patrón que
-- 20260531000001_security_profiles_audit_logs.sql):
--
-- Setup de prueba (usar 2 client_id reales que existan en public.clients,
-- y el id de un profile admin real):
--
-- insert into public.client_prospects (client_id, name) values
--   ('<client-A-uuid>', 'Prospecto de A'),
--   ('<client-B-uuid>', 'Prospecto de B');
--
-- 1. Cliente A NO ve el prospecto de Cliente B:
--    set local role = authenticated;
--    set local "request.jwt.claims" = '{"sub": "<user-id-cuyo-profile.client_id-es-client-A>"}';
--    select client_id, name from public.client_prospects;
--    → debe devolver solo la fila de A, nunca la de B
--
-- 2. Staff interno ve ambas:
--    set local "request.jwt.claims" = '{"sub": "<admin-user-id>"}';
--    select count(*) from public.client_prospects;
--    → debe devolver 2 (o el total real de la tabla)
--
-- 3. service_role sigue con acceso total (usado por la ruta de API):
--    reset role;
--    select count(*) from public.client_prospects;
--    → debe devolver el total real, sin restricción
-- ─────────────────────────────────────────────────────────────────────────
