-- Sector interno multi-tenant — paso 3: bypass total exclusivo del dueño
-- de la plataforma (Juampi), para la función "Ver Clientes".
--
-- Distinto del allowlist de OMNI_ALLOWED_EMAILS (lib/omni/owner.ts) que
-- incluye a Ann y Steffano para el piloto de Ann AI — acá el bypass
-- cross-tenant tiene que ser exclusivo del platform owner, nadie más.
--
-- Igual que is_admin()/is_internal_staff() (ver 20260810000001, decisión
-- ya documentada), esta función solo responde sobre la propia identidad
-- del caller (su email vía JWT), sin exponer datos de otros usuarios ni
-- efectos secundarios — se deja ejecutable por cualquiera a propósito,
-- mismo criterio.

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_catalog'
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'juampiacosta158@gmail.com'
  );
$$;
