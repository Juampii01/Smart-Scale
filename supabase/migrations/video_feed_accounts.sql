create table if not exists public.video_feed_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade unique,
  platform       text,
  channel_url    text,
  channel_name   text,
  channel_avatar text,
  posts          jsonb,
  updated_at     timestamptz default now()
);

alter table public.video_feed_accounts enable row level security;

create policy "user_own_video_feed"
  on public.video_feed_accounts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admin_all_video_feed"
  on public.video_feed_accounts for all to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

notify pgrst, 'reload schema';
