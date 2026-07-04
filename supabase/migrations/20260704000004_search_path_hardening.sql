-- B-03 (auditoría 2026-05-31): funciones con search_path mutable — un usuario
-- con permiso de crear objetos en algún schema del search_path podría
-- shadowear una tabla/función referenciada sin schema-qualify dentro de estas
-- funciones SECURITY DEFINER/trigger. Mismo patrón ya usado en
-- is_internal_staff (20260531000001_security_profiles_audit_logs.sql).
alter function public.set_profiles_updated_at()          set search_path = 'public', 'pg_catalog';
alter function public.get_next_pending_request()          set search_path = 'public', 'pg_catalog';
alter function public.set_ann_knowledge_updated_at()      set search_path = 'public', 'pg_catalog';
alter function public.set_sops_updated_at()               set search_path = 'public', 'pg_catalog';
alter function public.handle_updated_at()                 set search_path = 'public', 'pg_catalog';
alter function public.handle_new_user()                   set search_path = 'public', 'pg_catalog';
alter function public.set_centro_op_pages_updated_at()     set search_path = 'public', 'pg_catalog';
alter function public.is_admin()                           set search_path = 'public', 'pg_catalog';
alter function public.set_client_id_uuid()                 set search_path = 'public', 'pg_catalog';
alter function public.fill_clients_nombre()                 set search_path = 'public', 'pg_catalog';
alter function public.set_client_playbook_pages_updated_at() set search_path = 'public', 'pg_catalog';
alter function public.set_client_playbook_main_updated_at()  set search_path = 'public', 'pg_catalog';
alter function public.set_updated_at()                      set search_path = 'public', 'pg_catalog';
