-- Suscripciones de Web Push (notificaciones al celular)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  name       text,                      -- nombre resuelto (Juampi/Fabri/Ann) para targetear
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_name ON push_subscriptions (name);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_sub_block_direct" ON push_subscriptions FOR SELECT USING (false);
