-- Sector interno multi-tenant — Fase 1 (panel interno por cliente): applications.
-- EXPAND (paso 1 de 2, expand/contract). Seguro con el código de `main`
-- corriendo sin cambios: solo agrega una columna nullable + backfill +
-- índice. No toca NOT NULL ni policies — eso es el CONTRACT
-- (20260825000003), que solo se aplica después de deployar el código de
-- esta rama. Aplicar el contract antes del deploy rompería /apply y
-- cualquier insert de `main` que no setee client_id.
--
-- `applications` no tenía ningún tipo de aislamiento por tenant —
-- cualquier interno con role=admin/team/setter veía las aplicaciones de
-- TODOS los clientes y de Smart Scale mezcladas (nombre, email y datos de
-- gente que aplicó). Mismo patrón que 20260812150007_leads_multitenant.sql.

alter table public.applications add column if not exists client_id uuid references public.clients(id);

update public.applications
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

create index if not exists applications_client_id_idx on public.applications (client_id);
