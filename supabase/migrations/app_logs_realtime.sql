-- Habilitar Realtime para app_logs (necesario para la suscripción en vivo del panel Dev Logs)
ALTER PUBLICATION supabase_realtime ADD TABLE app_logs;
