-- El índice único parcial de 20260820000001_payments_idempotency.sql rompía
-- TODO upsert real del webhook de pagos desde que se aplicó: Postgres no
-- puede resolver `ON CONFLICT (external_event_id)` contra un índice con
-- `WHERE external_event_id is not null` — solo contra una constraint/índice
-- único plano. Cada intento (Zapier, tests) fallaba con
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" y ningún pago se guardaba desde el 27/8.
--
-- Un índice único plano (sin WHERE) ya permite múltiples NULL sin chocar
-- entre sí — comportamiento estándar de Postgres — así que las filas
-- históricas sin external_event_id siguen sin romperse.
drop index if exists public.payments_external_event_id_key;

create unique index if not exists payments_external_event_id_key
  on public.payments (external_event_id);
