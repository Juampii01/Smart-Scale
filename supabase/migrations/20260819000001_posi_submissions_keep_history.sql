-- Hasta ahora client_posi_submissions tenía unique(client_id, level_id) y el
-- POST hacía upsert onConflict — cada vez que un cliente volvía a responder
-- un nivel (ej. después de reprobar), la respuesta nueva PISABA la anterior.
-- Pedido explícito: guardar todos los intentos, no solo el último.
alter table public.client_posi_submissions
  drop constraint if exists client_posi_submissions_client_id_level_id_key;

-- El código ya no filtra/lee por esta combinación como si fuera única, pero
-- sigue siendo el patrón de acceso más común (un cliente, un nivel) — vale
-- la pena como índice no-único para esas queries.
create index if not exists client_posi_submissions_client_level_idx
  on public.client_posi_submissions(client_id, level_id, submitted_at desc);
