-- Reporte Mensual en 5 pasos (Commit 2/4) — columnas nuevas para el paso de
-- Reflexión (confianza por etapa + recomendación) y el paso de Invitar
-- (valor de contratos firmados, separado de cash_collected).
--
-- Todas nullable, ninguna con default — no rompen filas existentes.
-- Tipos: mismo patrón que nps_score (20260531000002_add_nps_score_monthly_reports.sql,
-- smallint + check 1–10) para las de confianza (acá 0–10), y mismo patrón
-- que cash_collected/mrr (numeric, sin precisión fija) para new_business_value.

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS conf_short_form smallint
    CHECK (conf_short_form BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS conf_long_form smallint
    CHECK (conf_long_form BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS conf_email smallint
    CHECK (conf_email BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS conf_business smallint
    CHECK (conf_business BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS new_business_value numeric,
  ADD COLUMN IF NOT EXISTS recommendation text;

COMMENT ON COLUMN public.monthly_reports.conf_short_form IS
  'Confianza del cliente en formato corto, 0–10 (paso 1 · Atraer del wizard).';
COMMENT ON COLUMN public.monthly_reports.conf_long_form IS
  'Confianza del cliente en formato largo, 0–10 (paso 2 · Educar del wizard).';
COMMENT ON COLUMN public.monthly_reports.conf_email IS
  'Confianza del cliente en email, 0–10 (paso 2 · Educar del wizard).';
COMMENT ON COLUMN public.monthly_reports.conf_business IS
  'Confianza del cliente en el negocio, 0–10 (paso 4 · Transformar del wizard).';
COMMENT ON COLUMN public.monthly_reports.new_business_value IS
  'Valor de los contratos firmados en el mes — distinto de cash_collected (lo efectivamente cobrado). Mismo control de visibilidad que cash_collected/mrr: ver nota abajo.';
COMMENT ON COLUMN public.monthly_reports.recommendation IS
  'Texto libre al lado del NPS (paso 5 · Reflexión del wizard).';

-- Nota sobre visibilidad financiera de new_business_value:
-- monthly_reports_select (20260820000002_monthly_reports_financial_staff_only.sql)
-- es una policy a nivel de FILA, no de columna: is_financial_staff() (admin/
-- developer/team) OR "es tu propio cliente". No existe ninguna policy con
-- lista explícita de columnas en esta tabla — cash_collected y mrr no tienen
-- ninguna protección extra más allá de esa policy de fila, así que
-- new_business_value ya queda con exactamente la misma visibilidad en
-- cuanto se agrega la columna, sin necesidad de tocar la policy.

NOTIFY pgrst, 'reload schema';
