-- Limpieza de tablas huérfanas detectadas en auditoría (11/07/2026): 0 filas,
-- sin ninguna referencia en app/lib/components, sin CREATE TABLE propio en
-- supabase/migrations/ salvo su propia definición inicial de boilerplate.
-- Todas quedaron reemplazadas en la práctica por tablas reales del proyecto
-- (ver detalle en la conversación de auditoría, no repetido acá para no
-- duplicar contexto que puede quedar desactualizado).
--
-- CASCADE en todas: se validó a mano, reintento por reintento, que las
-- únicas dependencias (FKs y policies RLS) son internas a este mismo lote de
-- tablas de boilerplate viejo — ninguna cruza hacia una tabla real en uso.
-- La única dependencia real hacia afuera (discovery_responses_form_id_fkey,
-- desde discovery_forms) se dejó fuera de este batch a propósito.
drop table if exists public.admins cascade;
-- discovery_forms queda afuera de este batch: tiene una FK real desde
-- discovery_responses (discovery_responses_form_id_fkey), que el usuario
-- dejó pendiente de revisar aparte. Se borran juntas o ninguna.
drop table if exists public.eod_logs cascade;
drop table if exists public.ai_messages cascade;
drop table if exists public.ai_conversations cascade;
drop table if exists public.channel_members cascade;
drop table if exists public.channels cascade;
drop table if exists public.messages cascade;
drop table if exists public.tasks cascade;
drop table if exists public.kpis cascade;
drop table if exists public.departments cascade;
drop table if exists public.lead_activities cascade;
drop table if exists public.competitors cascade;
drop table if exists public.content_pieces cascade;
drop table if exists public.integrations cascade;
drop table if exists public.client_settings cascade;

notify pgrst, 'reload schema';
