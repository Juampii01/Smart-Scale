-- Solicitudes de acceso a métricas de Instagram (formulario público, sin login).
-- El cliente carga su @usuario para que el equipo lo agregue como tester/developer
-- en la app de Meta y poder traer sus métricas. Aditiva. Aplicar en el SQL editor.

CREATE TABLE IF NOT EXISTS public.instagram_access_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  instagram       text        NOT NULL,            -- @usuario normalizado o link
  email           text,
  is_professional boolean     NOT NULL DEFAULT false,
  status          text        NOT NULL DEFAULT 'nueva',  -- nueva | invitado | conectado | rechazado
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_access_requests ENABLE ROW LEVEL SECURITY;

-- Acceso siempre por service_role (la API pública usa el service client). Igual que applications/leads.
DROP POLICY IF EXISTS "service_role_all" ON public.instagram_access_requests;
CREATE POLICY "service_role_all" ON public.instagram_access_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS instagram_access_requests_created_idx
  ON public.instagram_access_requests (created_at DESC);
