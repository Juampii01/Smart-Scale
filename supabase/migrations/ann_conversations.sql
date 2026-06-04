-- Historial de conversaciones de Ann AI.
-- messages: array JSONB [{role, content, tools?}]
-- month: 'YYYY-MM' para contar el límite mensual por usuario

CREATE TABLE IF NOT EXISTS ann_conversations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  client_id  uuid,
  title      text NOT NULL DEFAULT 'Nueva conversación',
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  month      text NOT NULL,                          -- ej: '2026-06'
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ann_conv_user_month ON ann_conversations (user_id, month);
CREATE INDEX IF NOT EXISTS idx_ann_conv_client     ON ann_conversations (client_id);
