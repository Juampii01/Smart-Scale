-- content_research_history: tenía RLS activo pero solo una política "user_id = auth.uid()".
-- Problema: cuando el admin hace investigación para un cliente, el registro se guardaba con
-- user_id = admin_id. El cliente nunca podía verlo via query directa a Supabase.
-- Fix en código: el API ahora guarda user_id del cliente (ya corregido en route.ts).
-- Fix aquí: agregar política service_role para acceso completo desde el backend.

CREATE POLICY "service_role_all_content_research_history"
  ON content_research_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);
