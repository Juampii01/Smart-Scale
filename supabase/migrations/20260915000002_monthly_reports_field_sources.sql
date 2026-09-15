-- Reporte Mensual en 5 pasos (Commit 4/4) — de dónde salió cada campo
-- auto-completable: "auto" (se dejó el valor que trajo la plataforma) o
-- "manual" (la persona lo pisó a mano). Sin esto no se puede saber después
-- por qué un número no coincide con lo que muestra el prefill.
--
-- jsonb, nullable, sin default — ej: {"cash_collected":"auto","mrr":"manual"}.
-- Solo lleva entradas para los campos que soportan AUTO (cash_collected,
-- mrr, new_clients, active_clients, yt_new_subscribers, email_new_subscribers).

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS field_sources jsonb;

COMMENT ON COLUMN public.monthly_reports.field_sources IS
  'Por campo auto-completable: "auto" (se usó el valor que trajo la plataforma) o "manual" (se pisó a mano). Ej: {"cash_collected":"auto","mrr":"manual"}.';

NOTIFY pgrst, 'reload schema';
