-- Campos personalizados (columnas custom estilo Airtable) para leads.
-- Aditiva y no destructiva: solo agrega. Aplicar en el SQL editor de Supabase.

-- 1) Valores por lead: un jsonb { columnKey: value }
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Definiciones de columnas (compartidas por todo el CRM)
CREATE TABLE IF NOT EXISTS public.lead_columns (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,   -- clave estable usada en leads.custom_fields
  label      text        NOT NULL,          -- nombre visible de la columna
  type       text        NOT NULL DEFAULT 'text',  -- 'text' | 'number'
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_columns ENABLE ROW LEVEL SECURITY;

-- El acceso va siempre por service_role (la API valida rol admin/team). Igual que leads.
DROP POLICY IF EXISTS "service_role_all" ON public.lead_columns;
CREATE POLICY "service_role_all" ON public.lead_columns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS lead_columns_position_idx ON public.lead_columns (position);
