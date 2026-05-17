-- Add visible_to_client column to client_playbook_main table
-- Allows clients to "reveal" their playbook with a one-time button click
-- Default false = playbook hidden, button visible
-- True = playbook visible, button hidden (permanent)

alter table public.client_playbook_main
  add column if not exists visible_to_client boolean not null default false;

-- Index for quick lookup when filtering by visibility
create index if not exists client_playbook_main_visible_idx
  on public.client_playbook_main (client_id, visible_to_client);
