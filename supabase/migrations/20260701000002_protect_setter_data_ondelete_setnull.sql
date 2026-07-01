-- Blindaje: borrar el usuario de un setter ya NO borra su data histórica.
--
-- Mismo problema que setting_daily_logs (arreglado en la migración anterior):
-- estas tablas tenían ON DELETE CASCADE contra auth.users, así que eliminar el
-- usuario borraba en cascada las comisiones, métricas mensuales y el EOD personal
-- del setter. Pasamos a ON DELETE SET NULL: al borrar el usuario los registros
-- sobreviven y solo se desvincula la FK.
--
-- NO se toca profiles(id -> auth.users, CASCADE): ahí el borrado es correcto,
-- el perfil ES el usuario. Tampoco las tablas de data de cliente
-- (content_research_history, research_requests, transcript_history,
-- video_feed_accounts), que se deciden aparte.

-- setter_commissions
alter table public.setter_commissions alter column setter_id drop not null;
alter table public.setter_commissions drop constraint if exists setter_commissions_setter_id_fkey;
alter table public.setter_commissions
  add constraint setter_commissions_setter_id_fkey
  foreign key (setter_id) references auth.users(id) on delete set null;

-- setter_monthly_metrics
alter table public.setter_monthly_metrics alter column setter_id drop not null;
alter table public.setter_monthly_metrics drop constraint if exists setter_monthly_metrics_setter_id_fkey;
alter table public.setter_monthly_metrics
  add constraint setter_monthly_metrics_setter_id_fkey
  foreign key (setter_id) references auth.users(id) on delete set null;

-- eod_logs (diario EOD personal)
alter table public.eod_logs alter column user_id drop not null;
alter table public.eod_logs drop constraint if exists eod_logs_user_id_fkey;
alter table public.eod_logs
  add constraint eod_logs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
