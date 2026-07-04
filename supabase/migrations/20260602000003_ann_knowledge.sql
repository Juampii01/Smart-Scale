-- ═══════════════════════════════════════════════════════════════════════════════
-- El "Cerebro de Ann" — base de conocimiento que alimenta a Ann AI
--
-- Acá se acumula TODA la metodología de Ann: el Ecosistema Circular completo,
-- documentos, transcripciones, marcos de trabajo, SOPs. Ann AI lee las entradas
-- activas y las usa para responder citando el método real (no inventa).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ann_knowledge (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  content     text NOT NULL,
  pillar      text DEFAULT 'general',   -- 'F' | 'E' | 'T' | 'I' | 'general'
  source_type text DEFAULT 'manual',    -- 'manual' | 'transcript' | 'documento'
  sort_order  int  DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ann_knowledge_active ON public.ann_knowledge (is_active, sort_order);

ALTER TABLE public.ann_knowledge ENABLE ROW LEVEL SECURITY;

-- Solo service_role (los route handlers gateados a admin/developer). El cerebro
-- nunca se expone directo al cliente vía PostgREST.
CREATE POLICY "service_role_all_ann_knowledge"
  ON public.ann_knowledge FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_ann_knowledge_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ann_knowledge_updated_at ON public.ann_knowledge;
CREATE TRIGGER trg_ann_knowledge_updated_at
  BEFORE UPDATE ON public.ann_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.set_ann_knowledge_updated_at();
