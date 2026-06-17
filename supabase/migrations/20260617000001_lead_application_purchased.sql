-- ════════════════════════════════════════════════════════════════════════════
-- "Compró / no compró" en leads y applications
-- ════════════════════════════════════════════════════════════════════════════
-- Marcador rápido (filita) para saber qué leads/aplicaciones terminaron
-- comprando, independiente del estado del CRM.
-- Seguro de correr varias veces.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.leads        add column if not exists purchased boolean not null default false;
alter table public.applications add column if not exists purchased boolean not null default false;

create index if not exists leads_purchased_idx        on public.leads (purchased);
create index if not exists applications_purchased_idx on public.applications (purchased);

notify pgrst, 'reload schema';
