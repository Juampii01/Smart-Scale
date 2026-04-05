-- Transcript history table
create table if not exists public.transcript_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  url         text not null,
  title       text,
  creator     text,
  duration    text,
  transcript  text,
  summary     text,
  created_at  timestamptz default now()
);

-- RLS
alter table public.transcript_history enable row level security;

-- Admin: full access
create policy "admin_all_transcript_history"
  on public.transcript_history
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Users: only own rows
create policy "user_own_transcript_history"
  on public.transcript_history
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Index for fast user queries
create index if not exists transcript_history_user_id_idx
  on public.transcript_history(user_id, created_at desc);

-- Reload schema cache
notify pgrst, 'reload schema';
