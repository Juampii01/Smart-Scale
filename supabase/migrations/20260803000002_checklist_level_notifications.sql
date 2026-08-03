-- Program Checklist ("Posi") — aviso a Slack cuando un cliente completa un
-- nivel (>= 80% de las tareas de ese nivel). Una fila por (client_id, level)
-- para no re-avisar cada vez que se togglea una tarea del mismo nivel.

create table if not exists client_checklist_level_notifications (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  level        text not null,
  pct          integer not null,
  notified_at  timestamptz not null default now(),
  unique (client_id, level)
);

alter table client_checklist_level_notifications enable row level security;

drop policy if exists "service_role_all" on client_checklist_level_notifications;
create policy "service_role_all" on client_checklist_level_notifications
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
