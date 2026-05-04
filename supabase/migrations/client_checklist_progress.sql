-- ============================================================================
-- Progreso del checklist de Implementacion por cliente
-- ============================================================================
-- Una row por (client_id, task_key) cuando una tarea está marcada como hecha.
-- task_key = month + label (mismo formato que usaba el localStorage anterior).
-- Cuando se destilda → se elimina la row (no se setea completed=false).

create table if not exists client_checklist_progress (
  client_id   uuid not null,
  task_key    text not null,
  completed   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (client_id, task_key)
);

create index if not exists client_checklist_progress_client_id_idx
  on client_checklist_progress (client_id);

alter table client_checklist_progress enable row level security;

drop policy if exists "service_role_all" on client_checklist_progress;
create policy "service_role_all"
  on client_checklist_progress
  for all
  to service_role
  using (true)
  with check (true);
