-- client_prospects_access (una sola policy "for all" con is_internal_staff()
-- como bypass total) le daba a cualquier interno LECTURA Y ESCRITURA sobre
-- el pipeline de cualquier cliente. Ahora que este motor pasa a ser el del
-- CRM interno del cliente, aplica la misma regla ya establecida ahí
-- (prompt-crm.md → Permisos): "El equipo de Smart Scale entra en solo
-- lectura, sin excepciones". Se separa en SELECT (staff+dueño) vs.
-- INSERT/UPDATE/DELETE (solo dueño) — mismo criterio que
-- is_crm_owner_client() en client_crm_prospects (20260824000001).

drop policy if exists "client_prospects_access" on public.client_prospects;

create policy "client_prospects_select" on public.client_prospects
  for select to authenticated
  using (is_crm_owner_client(client_id) or public.is_internal_staff() or public.is_platform_owner());

create policy "client_prospects_insert" on public.client_prospects
  for insert to authenticated
  with check (is_crm_owner_client(client_id));

create policy "client_prospects_update" on public.client_prospects
  for update to authenticated
  using (is_crm_owner_client(client_id))
  with check (is_crm_owner_client(client_id));

create policy "client_prospects_delete" on public.client_prospects
  for delete to authenticated
  using (is_crm_owner_client(client_id));

notify pgrst, 'reload schema';
