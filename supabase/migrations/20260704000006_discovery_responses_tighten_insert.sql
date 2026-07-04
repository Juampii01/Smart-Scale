-- Hallazgo nuevo (advisor de Supabase, 2026-07-04): discovery_responses tiene
-- una policy de INSERT abierta a "public" (incluye anon, sin sesión) con
-- WITH CHECK true. La tabla no tiene ninguna referencia en el código de la
-- app (ninguna vista/API la usa) y está vacía (0 filas) — nadie legítimo
-- necesita insertar sin sesión. Se restringe a authenticated para sacar el
-- vector de spam anónimo, sin asumir que la feature esté descartada.
drop policy if exists "Anyone can submit responses" on public.discovery_responses;
create policy "authenticated_can_submit_responses" on public.discovery_responses
  for insert
  to authenticated
  with check (true);
