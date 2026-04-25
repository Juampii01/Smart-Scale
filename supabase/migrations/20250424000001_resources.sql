-- Biblioteca de Recursos: links, docs, videos, archivos
create table if not exists resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null,
  description text,
  category    text not null default 'General',
  type        text not null default 'link',  -- link | doc | video | file
  created_at  timestamptz not null default now()
);

alter table resources enable row level security;

-- Service role puede todo (API routes)
create policy "service_role_all_resources"
  on resources for all to service_role
  using (true) with check (true);

-- Usuarios autenticados pueden leer
create policy "authenticated_read_resources"
  on resources for select to authenticated
  using (true);
