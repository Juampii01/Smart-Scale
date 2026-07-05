-- Tracking del email automático de renovación (se manda una sola vez cuando
-- al programa del cliente le quedan pocos días, o a mano desde el admin).
alter table public.crm_clients
  add column if not exists renewal_email_sent_at timestamptz;
