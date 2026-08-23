-- El webhook de pagos (app/api/webhooks/payment) hacía un insert seco, sin
-- ninguna marca de "este evento ya lo procesé". Zapier reintenta cuando algo
-- tarda o falla, y cada reintento insertaba un pago duplicado — el mismo
-- cobro quedaba contado dos veces en /admin/payments y en cualquier reporte
-- que sume "Pagos aceptados".
alter table public.payments
  add column if not exists external_event_id text;

-- Parcial: las filas históricas sin external_event_id no chocan entre sí.
create unique index if not exists payments_external_event_id_key
  on public.payments (external_event_id)
  where external_event_id is not null;
