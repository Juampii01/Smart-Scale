create table if not exists crm_clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text,
  instagram           text,
  phone               text,
  program_start       date not null,
  num_installments    int not null default 1,
  installment_amount  numeric(12,2) not null default 0,
  status              text not null default 'activo',  -- activo | inactivo | completado
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table crm_clients enable row level security;
create policy "service_role_all_clients" on crm_clients for all to service_role using (true) with check (true);

create table if not exists crm_installments (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references crm_clients(id) on delete cascade,
  installment_number  int not null,
  due_date            date not null,
  amount              numeric(12,2) not null,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);
alter table crm_installments enable row level security;
create policy "service_role_all_installments" on crm_installments for all to service_role using (true) with check (true);

create table if not exists crm_followups (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references crm_clients(id) on delete cascade,
  scheduled_date  date not null,
  type            text not null default 'whatsapp',  -- whatsapp | llamada | email | otro
  notes           text,
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table crm_followups enable row level security;
create policy "service_role_all_followups" on crm_followups for all to service_role using (true) with check (true);
