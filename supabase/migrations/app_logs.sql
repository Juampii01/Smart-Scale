-- Logs de la aplicación para el panel de desarrollo.
-- Solo admin puede leer/borrar. Se escribe con service role desde los API routes.

CREATE TABLE IF NOT EXISTS app_logs (
  id         bigserial PRIMARY KEY,
  level      text NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
  route      text,
  message    text NOT NULL,
  context    jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para filtrar rápido
CREATE INDEX IF NOT EXISTS idx_app_logs_level      ON app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs (created_at DESC);

-- RLS: solo service role puede insertar; solo admins autenticados pueden leer/borrar
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Lectura: solo admin (se maneja en el API con requireAdmin, esta policy es defensiva)
CREATE POLICY "app_logs_admin_select" ON app_logs
  FOR SELECT USING (false); -- bloqueado a nivel RLS, se lee con service client

-- Auto-limpieza: borrar logs de más de 7 días (evitar que crezca la tabla)
-- Se puede correr manualmente o via cron. Por ahora solo dejamos la tabla acotada.
