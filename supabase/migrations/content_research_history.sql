-- Content Research history table
create table if not exists public.content_research_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  channel_url     text not null,
  channel_name    text,
  channel_avatar  text,
  timeframe_days  int,
  platform        text,
  videos          jsonb,
  created_at      timestamptz default now()
);

-- Add missing columns to existing tables (safe to run multiple times)
alter table public.content_research_history add column if not exists platform text;
alter table public.content_research_history add column if not exists channel_avatar text;

alter table public.content_research_history enable row level security;

create policy "admin_all_content_research_history"
  on public.content_research_history for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "user_own_content_research_history"
  on public.content_research_history for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists content_research_history_user_id_idx
  on public.content_research_history(user_id, created_at desc);

notify pgrst, 'reload schema';
