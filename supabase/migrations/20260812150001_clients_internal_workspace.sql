-- Sector interno multi-tenant — paso 1: bootstrap del tenant de Smart Scale.
--
-- Cada cliente del portal va a poder tener su propio "sector interno"
-- (Leads/Setting/Prospección), aislado del resto. Para que las tablas
-- nuevas puedan usar `client_id not null references clients(id)` sin
-- excepciones, el propio negocio de Ann/Smart Scale necesita una fila en
-- `clients` que represente SU sector interno — se reusa la tabla del
-- portal (mismo FK target que ya usa `client_prospects`) en vez de crear
-- una tabla nueva.
--
-- `is_internal_workspace` es la única señal necesaria para excluir esta
-- fila de selectores de "clientes reales" del portal — no rompe nada
-- existente porque hoy ningún selector de cliente lee `public.clients`
-- completo sin filtrar (el de creación de usuarios lee `crm_clients`).

alter table public.clients
  add column if not exists is_internal_workspace boolean not null default false;

insert into public.clients (id, name, nombre, is_internal_workspace)
select gen_random_uuid(), 'Smart Scale (Internal)', 'Smart Scale (Internal)', true
where not exists (
  select 1 from public.clients where is_internal_workspace = true
);
