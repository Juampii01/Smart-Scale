-- ════════════════════════════════════════════════════════════════════════════
-- Performance Status — casos de éxito documentados
-- ════════════════════════════════════════════════════════════════════════════
-- Cantidad acumulada de casos de éxito documentados del core offer. Es el
-- segundo sub-requisito de la señal "Tracción de Oferta" (10+ ventas Y 5+ casos)
-- del Performance Status (Ecosistema Circular MVP).
-- El cliente la carga en el reporte mensual con el total acumulado a la fecha.
-- Seguro de correr varias veces.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.monthly_reports
  add column if not exists case_studies integer;

comment on column public.monthly_reports.case_studies is
  'Cantidad acumulada de casos de éxito documentados del core offer (señal de Tracción de Oferta en el Performance Status).';

notify pgrst, 'reload schema';
