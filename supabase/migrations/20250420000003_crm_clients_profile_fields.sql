alter table crm_clients
  add column if not exists address            text,
  add column if not exists dashboard_email    text,
  add column if not exists dashboard_password text;
