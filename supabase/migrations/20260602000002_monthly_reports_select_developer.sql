-- Incluir 'developer' (y futuros roles internos) en la lectura de monthly_reports.
--
-- La política anterior hardcodeaba ['admin','team','setter'] → un developer NO
-- podía leer los reportes de otros clientes (solo el suyo propio), y el selector
-- de meses se bloqueaba a los meses de su propia cuenta.
--
-- Fix: usar is_internal_staff() (que ya incluye admin/developer/team/setter)
-- en lugar de la lista hardcodeada. Cliente sigue viendo solo los suyos.

DROP POLICY IF EXISTS "monthly_reports_select" ON public.monthly_reports;

CREATE POLICY "monthly_reports_select"
  ON public.monthly_reports FOR SELECT TO authenticated
  USING (
    public.is_internal_staff()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.client_id = monthly_reports.client_id
    )
  );
