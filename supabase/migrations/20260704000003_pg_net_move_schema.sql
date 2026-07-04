-- M-08 (auditoría 2026-05-31): pg_net instalada en schema public — el lint
-- extension_in_public de Supabase recomienda un schema dedicado para
-- extensiones, así no comparten namespace con las tablas de la app.
create schema if not exists extensions;
alter extension pg_net set schema extensions;
