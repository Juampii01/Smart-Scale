-- ═══════════════════════════════════════════════════════════════════════════════
-- Persistencia de Monday Wins y Cha-Ching
--
-- Hasta ahora estos formularios solo disparaban a Zapier (Slack) y NO guardaban
-- nada en la base. Esto crea las tablas para que queden registrados en el
-- dashboard (como monthly_reports) y la IA (ANAI) pueda consultarlos.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Monday Wins ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monday_wins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id)     ON DELETE SET NULL,
  fecha         date NOT NULL,
  logro_1       text NOT NULL,
  logro_2       text,
  logro_3       text,
  una_sola_cosa text,
  bloqueo       text,
  submitted_by  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monday_wins_client_id ON public.monday_wins (client_id);
CREATE INDEX IF NOT EXISTS idx_monday_wins_fecha     ON public.monday_wins (fecha DESC);

ALTER TABLE public.monday_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_monday_wins"
  ON public.monday_wins FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Cliente ve los suyos; staff interno (admin/developer/team/setter) ve todos.
CREATE POLICY "monday_wins_select"
  ON public.monday_wins FOR SELECT TO authenticated
  USING (
    public.is_internal_staff()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.client_id = monday_wins.client_id
    )
  );

-- ─── Cha-Ching (ventas registradas) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cha_ching (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id)     ON DELETE SET NULL,
  fecha          date NOT NULL,
  valor_trato    numeric NOT NULL,
  cash_collected numeric NOT NULL,
  proximo_nivel  text,
  notas          text,
  submitted_by   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cha_ching_client_id ON public.cha_ching (client_id);
CREATE INDEX IF NOT EXISTS idx_cha_ching_fecha     ON public.cha_ching (fecha DESC);

ALTER TABLE public.cha_ching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_cha_ching"
  ON public.cha_ching FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "cha_ching_select"
  ON public.cha_ching FOR SELECT TO authenticated
  USING (
    public.is_internal_staff()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.client_id = cha_ching.client_id
    )
  );
