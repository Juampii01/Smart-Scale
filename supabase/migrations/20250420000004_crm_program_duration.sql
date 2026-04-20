-- Separate program duration (months) from number of payment installments
alter table crm_clients
  add column if not exists program_duration int;

-- Backfill: for existing rows, duration = num_installments (old behavior)
update crm_clients
  set program_duration = num_installments
  where program_duration is null;
