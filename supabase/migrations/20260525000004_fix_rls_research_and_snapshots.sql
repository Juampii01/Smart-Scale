-- research_requests: tenía 2 políticas pero RLS estaba OFF → dead code.
-- Activar RLS para que las políticas ya existentes empiecen a aplicarse.
ALTER TABLE research_requests ENABLE ROW LEVEL SECURITY;

-- Agregar service_role (faltaba en las políticas originales)
CREATE POLICY "service_role_all_research_requests"
  ON research_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- competitor_snapshots: sin RLS, sin policies.
-- Solo service_role accede (igual que el resto de tablas de análisis de mercado).
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_competitor_snapshots"
  ON competitor_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);
