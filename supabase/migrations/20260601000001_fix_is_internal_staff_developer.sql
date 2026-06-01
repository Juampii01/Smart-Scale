-- Agregar 'developer' a is_internal_staff() para que el rol developer
-- pueda leer todos los perfiles (igual que admin) via la policy RLS
-- profiles_select_internal que usa esta función.
--
-- Sin esto, un developer solo ve su propio perfil (profiles_select_own)
-- y no puede switchear entre clientes en el selector del dashboard.

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'developer', 'team', 'setter')
  );
$$;
