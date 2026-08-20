-- Hallazgo #10: el dedup de payfunnels era solo por email — no distinguía
-- "reintento del mismo pago" de "cliente que renueva o compra de nuevo".
-- Ambos casos llegan con el mismo email; el que los distingue es el id de
-- transacción. No es UNIQUE a propósito: el log de payload crudo se
-- guarda SIEMPRE, incluso si el body no trae transaction_id (quedaría
-- null) — un índice único forzaría a perder ese registro en ese caso.
alter table public.payfunnels_webhook_events
  add column if not exists transaction_id text;

create index if not exists payfunnels_webhook_events_transaction_id_idx
  on public.payfunnels_webhook_events (transaction_id)
  where transaction_id is not null;
