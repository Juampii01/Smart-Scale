-- ═══════════════════════════════════════════════════════════════════════════════
-- outbound_events + event_logs
--
-- Cola de eventos salientes (Zapier / Slack) con reintentos automáticos.
-- El route /api/events/process y el Edge Function event-dispatcher la leen.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.outbound_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  client_id       uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users(id)    ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','completed','failed')),
  attempts        int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 3,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- índices para el polling del dispatcher
CREATE INDEX IF NOT EXISTS idx_outbound_events_status_retry
  ON public.outbound_events (status, next_retry_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_outbound_events_client_id
  ON public.outbound_events (client_id);

-- RLS: solo service_role escribe/lee (nunca acceso directo de cliente)
ALTER TABLE public.outbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_outbound_events"
  ON public.outbound_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── event_logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid REFERENCES public.outbound_events(id) ON DELETE CASCADE,
  level      text NOT NULL CHECK (level IN ('info','warn','error')),
  message    text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_id
  ON public.event_logs (event_id);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_event_logs"
  ON public.event_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
