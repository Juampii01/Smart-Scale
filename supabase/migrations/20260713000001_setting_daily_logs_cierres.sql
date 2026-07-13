-- Agrega "cierres" al EOD diario del Setting CRM — el setter carga cuántos
-- contratos cerró ese día, igual que el resto de las métricas manuales
-- (calls_done, qualified_leads, etc.). Se usa para comparar contra los
-- onboardings reales del mes (onboarding_flow.contract_signed_at).
ALTER TABLE setting_daily_logs
ADD COLUMN IF NOT EXISTS cierres INTEGER DEFAULT 0;

COMMENT ON COLUMN setting_daily_logs.cierres IS 'Cantidad de contratos cerrados ese día (carga manual del setter)';
