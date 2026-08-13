-- Título/subtítulo fijo de la página Founder → POSI (/admin/posi), hoy
-- hardcodeado en el JSX. Tabla singleton — mismo patrón que
-- omni_prospecting_context (PK textual fija, no es contenido de un nivel
-- del programa POSI, es copy de UI del panel admin).

create table public.posi_page_settings (
  id         text primary key default 'posi',
  title      text not null default 'POSI',
  subtitle   text not null default 'Un link por nivel — pegalo en Slack cuando el cliente llegue ahí. El formulario no está dentro de la plataforma: solo por link, logueado con su cuenta.',
  updated_at timestamptz not null default now()
);

insert into public.posi_page_settings (id) values ('posi');

alter table public.posi_page_settings enable row level security;

create policy "service_role_all" on public.posi_page_settings
  for all to service_role using (true) with check (true);
