-- Throttle del email de inactividad ("hace X días que no entrás") a máximo
-- 1 por semana por cliente — sin esto, el cron lo mandaría todos los días
-- mientras el cliente siga sin loguearse (a diferencia de Monday Win / reporte
-- mensual, cuya condición solo es verdadera en ventanas de días puntuales).
alter table public.profiles
  add column if not exists last_inactivity_email_sent_at timestamptz;
