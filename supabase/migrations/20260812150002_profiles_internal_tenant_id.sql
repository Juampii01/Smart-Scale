-- Sector interno multi-tenant — paso 2: columna nueva y SEPARADA de
-- `profiles.client_id`.
--
-- `profiles.client_id` ya está en uso hoy para un propósito distinto
-- (scope de Social/Content Research, via lib/social/scope.ts) — Ann y
-- Juampi ya tienen cada uno su propio client_id ahí, apuntando a filas
-- de `clients` con datos reales enganchados (social_connections,
-- content_research_history). Reusarlo acá los dejaría en tenants
-- DISTINTOS entre sí, rompiendo la premisa de que comparten sector
-- interno, y arrastraría una feature que no corresponde tocar.
--
-- `internal_tenant_id` es el campo nuevo, exclusivo del sector interno
-- (Leads/Setting/Prospección). NULL para role='client'.

alter table public.profiles
  add column if not exists internal_tenant_id uuid references public.clients(id) on delete restrict;

create index if not exists profiles_internal_tenant_id_idx on public.profiles (internal_tenant_id);

comment on column public.profiles.internal_tenant_id is
  'Tenant del sector interno (admin/team/setter) al que pertenece este profile — Leads/Setting/Prospección. Independiente de profiles.client_id (scope legado de Social/Content Research, y client_id real para role=client). NULL para role=client.';

-- Backfill: todos los profiles internos existentes hoy pertenecen a
-- Smart Scale — es el estado actual de facto.
update public.profiles
set internal_tenant_id = (select id from public.clients where is_internal_workspace = true)
where lower(coalesce(role, '')) in ('admin', 'developer', 'team', 'setter')
  and internal_tenant_id is null;
