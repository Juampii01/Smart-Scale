-- calendar_events: eventos de la agenda semanal del programa
-- Administrable desde /admin/agenda sin necesidad de deploy

create table if not exists calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  day_of_week text,
  time        text,
  tz_label    text not null default 'Miami',
  zoom_url    text,
  passcode    text,
  status      text not null default 'active',
  recurrence  text not null default 'weekly',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table calendar_events enable row level security;

create policy "anon_read" on calendar_events for select using (true);
create policy "service_all" on calendar_events for all to service_role using (true) with check (true);

insert into calendar_events (title, description, day_of_week, time, tz_label, zoom_url, passcode, status, recurrence, sort_order) values
  ('Q&A: Ads · Content · Mindset',  'Con Ann Sahakyan',  'Lunes',   '3:00 PM', 'Miami', 'https://us06web.zoom.us/j/88326569602?pwd=En8DhWa6QIeAO4gFSPLSJHsRNHobjX.1', '009382', 'active', 'weekly',       1),
  ('Automatizaciones y Sistemas',   'Con Juampi Acosta', 'Martes',  '3:00 PM', 'Miami', 'https://us06web.zoom.us/j/82480101425?pwd=j6lHTzGjCw1WyL1I24gVX1u6goHmnB.1', '109565', 'active', 'weekly',       2),
  ('Lab / Q&A',                     'Con Ann Sahakyan',  'Jueves',  '3:00 PM', 'Miami', 'https://us06web.zoom.us/j/84528843654?pwd=knND3qWgX5OxRRffoHiZSmnaPuPaza.1', '585449', 'active', 'weekly',       3),
  ('Llamada mensual con Santi',     'Con Santiago',      'Viernes', '3:00 PM', 'Miami', null,                                                                           null,     'tbd',    'monthly_last', 4);
