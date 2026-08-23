-- monthly_reports_select usaba is_internal_staff() (admin/team/setter) para
-- leer facturación completa de toda la cartera (cash_collected, total_revenue,
-- mrr) — el setter es el rol de menor confianza del equipo y no debería poder
-- leerla ni siquiera vía RLS directo (hallazgo #3, auditoría 2026-08-20).
-- De paso corrige el auth.uid() sin cachear de la policy vieja.
create or replace function public.is_financial_staff()
returns boolean
language sql
security definer
stable
set search_path = 'public', 'pg_catalog'
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'developer', 'team')
  );
$$;

revoke execute on function public.is_financial_staff() from anon, public;
grant execute on function public.is_financial_staff() to authenticated;

drop policy if exists "monthly_reports_select" on public.monthly_reports;
create policy "monthly_reports_select" on public.monthly_reports for select to authenticated
using (
  public.is_financial_staff()
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.client_id = monthly_reports.client_id
  )
);
