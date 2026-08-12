-- Advisor de seguridad marcó set_prospeccion_updated_at() con search_path
-- mutable — mismo fix que ya se aplica a las demás funciones nuevas de
-- este batch (is_platform_owner, is_internal_staff).

create or replace function public.set_prospeccion_updated_at()
returns trigger
language plpgsql
set search_path = 'public', 'pg_catalog'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
