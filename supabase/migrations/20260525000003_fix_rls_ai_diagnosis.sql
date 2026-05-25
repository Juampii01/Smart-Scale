-- Activar RLS en ai_diagnosis_requests y ai_diagnosis_results.
-- Antes: RLS desactivado → cualquier usuario autenticado podía leer los
-- diagnósticos (prompts + resultados de Claude) de TODOS los clientes.
-- Fix: cada usuario solo ve sus propios registros; service_role acceso total.

ALTER TABLE ai_diagnosis_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ai_diagnosis_requests"
  ON ai_diagnosis_requests FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_all_ai_diagnosis_requests"
  ON ai_diagnosis_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Results no tiene user_id directo, se accede via request_id
ALTER TABLE ai_diagnosis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ai_diagnosis_results"
  ON ai_diagnosis_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_diagnosis_requests r
      WHERE r.id = ai_diagnosis_results.request_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_all_ai_diagnosis_results"
  ON ai_diagnosis_results FOR ALL TO service_role
  USING (true) WITH CHECK (true);
