-- Tabla research_requests
create table public.research_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.clients(id),
  platform text check (platform in ('youtube','instagram','tiktok')) not null,
  timeframe_days int check (timeframe_days in (30,60,90)) not null,
  competitors jsonb not null,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts int default 0,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create index idx_research_requests_status on public.research_requests(status);
create index idx_research_requests_user_id on public.research_requests(user_id);

-- Tabla research_results
create table public.research_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.research_requests(id) on delete cascade not null,
  summary text,
  patterns jsonb,
  top_hooks jsonb,
  opportunities jsonb,
  recommended_ideas jsonb,
  raw_competitor_data jsonb,
  created_at timestamptz default now()
);

create index idx_research_results_request_id on public.research_results(request_id);

-- RLS
alter table public.research_requests add column client_id uuid;
alter table public.research_requests alter column competitors type jsonb using competitors::jsonb;
alter table public.research_requests enable row level security;
create policy "Select own requests" on public.research_requests for select using (
  auth.uid() = user_id
  or (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) = 'admin'))
);
create policy "Insert own requests" on public.research_requests for insert with check (auth.uid() = user_id);

alter table public.research_results enable row level security;
create policy "Select own results" on public.research_results for select using (
  exists (
    select 1 from public.research_requests r
    where r.id = request_id and r.user_id = auth.uid()
  )
);

-- RPC: get_next_pending_request
create or replace function public.get_next_pending_request()
returns table (
  id uuid,
  user_id uuid,
  platform text,
  timeframe_days int,
  competitors jsonb,
  status text,
  attempts int,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
) language plpgsql as $$
declare
  req record;
begin
  select * into req from public.research_requests
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1;
  if not found then
    return;
  end if;
  update public.research_requests
    set status = 'processing',
        attempts = coalesce(attempts,0) + 1,
        started_at = now()
    where id = req.id;
  return query select * from public.research_requests where id = req.id;
end;
$$;
