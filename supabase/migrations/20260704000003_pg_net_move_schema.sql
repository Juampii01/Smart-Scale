-- M-08 (auditoría 2026-05-31): pg_net instalada en schema public — el lint
-- extension_in_public de Supabase recomienda un schema dedicado para
-- extensiones, así no comparten namespace con las tablas de la app.
--
-- pg_net no soporta "ALTER EXTENSION ... SET SCHEMA" (no implementa el hook
-- de relocate). Confirmado sin dependientes (pg_depend) y sin uso en el
-- código de la app — drop + recreate en el schema nuevo es seguro.
create schema if not exists extensions;
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
