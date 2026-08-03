-- Setting EOD: calificados separados por canal (inbound / outbound), en vez
-- de un solo "qualified_leads" combinado. No reemplaza a qualified_leads
-- ("Leads 4-5 estrellas") — es una métrica nueva, aparte.

alter table setting_daily_logs add column if not exists inbound_qualified  integer not null default 0;
alter table setting_daily_logs add column if not exists outbound_qualified integer not null default 0;

comment on column setting_daily_logs.inbound_qualified  is 'De las conversaciones inbound del día, cuántas fueron calificadas.';
comment on column setting_daily_logs.outbound_qualified is 'De las respuestas outbound del día, cuántas fueron calificadas.';
