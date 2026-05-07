-- SOPs (Standard Operating Procedures) — playbooks operativos con steps y templates copiables.

create table if not exists public.sops (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  frequency    text,                                     -- "Semanal - Jueves", "Ad hoc", etc.
  tags         text[] not null default array[]::text[],  -- ["llamada", "skool", "onboarding"]
  steps        jsonb not null default '[]'::jsonb,       -- [{order: 1, label: "..."}]
  templates    jsonb not null default '[]'::jsonb,       -- [{channel: "skool"|"slack"|..., label, body}]
  ai_generated boolean not null default false,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists sops_tags_idx       on public.sops using gin (tags);
create index if not exists sops_created_at_idx on public.sops (created_at desc);

alter table public.sops enable row level security;

-- Lectura: cualquier usuario interno (admin/team/setter)
drop policy if exists "internal_read_sops" on public.sops;
create policy "internal_read_sops"
  on public.sops for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) in ('admin','team','setter')
    )
  );

-- Escritura: solo admin
drop policy if exists "admin_insert_sops" on public.sops;
create policy "admin_insert_sops"
  on public.sops for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "admin_update_sops" on public.sops;
create policy "admin_update_sops"
  on public.sops for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

drop policy if exists "admin_delete_sops" on public.sops;
create policy "admin_delete_sops"
  on public.sops for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and lower(coalesce(profiles.role, '')) = 'admin'
    )
  );

-- Trigger para updated_at
create or replace function public.set_sops_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sops_set_updated_at on public.sops;
create trigger sops_set_updated_at
  before update on public.sops
  for each row execute function public.set_sops_updated_at();
