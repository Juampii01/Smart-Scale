-- Tabla competitor_posts
create table if not exists public.competitor_posts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  creator     text not null,
  post_url    text,
  description text,
  views       bigint,
  duration    text,
  likes       bigint,
  comments    bigint,
  transcript  text,
  analysis    text,
  created_at  timestamptz default now()
);

create index if not exists idx_competitor_posts_client_id on public.competitor_posts(client_id);
create index if not exists idx_competitor_posts_created_at on public.competitor_posts(created_at desc);

-- RLS
alter table public.competitor_posts enable row level security;

-- Admin can do everything
create policy "admin_all_competitor_posts" on public.competitor_posts
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and lower(p.role) = 'admin'
    )
  );

-- Client can read their own posts
create policy "client_read_own_competitor_posts" on public.competitor_posts
  for select
  using (
    client_id in (
      select p.client_id from public.profiles p
      where p.id = auth.uid()
    )
  );
