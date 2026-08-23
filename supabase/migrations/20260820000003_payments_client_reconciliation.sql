-- Etapa 1 (trazabilidad) del hallazgo #2 de la auditoría 2026-08-20: `payments`
-- no tenía ninguna columna que apuntara a un cliente — no había forma
-- automática de saber qué pago corresponde a quién, y las cuotas reales
-- (`crm_installments`) solo se marcaban pagadas a mano.
--
-- Etapa 2 en modo "sugerir": suggested_installment_id NO marca la cuota
-- pagada sola — solo deja la sugerencia para que el equipo la confirme con
-- un click en /admin/payments. Automatizar el marcado directo es más
-- riesgoso (una sugerencia mal calzada apaga un recordatorio real) y el
-- propio informe recomienda no saltarlo.
alter table public.payments
  add column if not exists client_id uuid references public.crm_clients(id) on delete set null,
  add column if not exists suggested_installment_id uuid references public.crm_installments(id) on delete set null;

create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists crm_clients_email_idx on public.crm_clients (lower(email));
