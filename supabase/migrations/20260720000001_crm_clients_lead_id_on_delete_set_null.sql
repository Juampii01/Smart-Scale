-- El FK crm_clients.lead_id -> leads(id) no tenía ON DELETE, así que Postgres
-- usaba el default (NO ACTION) y bloqueaba borrar un lead ya convertido a
-- cliente ("violates foreign key constraint crm_clients_lead_id_fkey").
-- SET NULL: se puede borrar el lead sin perder el cliente ni sus datos, solo
-- se corta la referencia de origen.
alter table public.crm_clients
  drop constraint crm_clients_lead_id_fkey;

alter table public.crm_clients
  add constraint crm_clients_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null;
