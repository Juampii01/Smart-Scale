-- Check-in trimestral de dinero por cliente (sector Founder, interno).
-- Base mínima: el equipo carga esto a mano después de la llamada con el
-- cliente (todavía no está automatizado ni es client-facing — eso quedó
-- pendiente de definir con Ann). Un registro por (client_id, quarter_label).

create table if not exists client_quarterly_checkins (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references clients(id) on delete cascade,
  quarter_label           text not null,            -- ej. "2026-Q3"
  best_month_cash         numeric,                  -- mes de mayor efectivo cobrado del trimestre
  revenue_bracket         numeric,                  -- escalón actual de revenue ($10k, $20k, ... $100k)
  next_quarter_goal_cash  numeric,
  new_clients_needed      integer,
  notes                   text,
  created_by              uuid references profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (client_id, quarter_label)
);

alter table client_quarterly_checkins enable row level security;

drop policy if exists "service_role_all" on client_quarterly_checkins;
create policy "service_role_all" on client_quarterly_checkins
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
