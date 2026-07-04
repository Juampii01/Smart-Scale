-- M-06 (auditoría 2026-05-31): la tabla competitor_posts tenía RLS activado
-- pero SIN policies cargadas en producción (rls_enabled_no_policy) — las
-- policies ya estaban definidas en supabase/migrations/competitor_posts.sql
-- pero nunca llegaron a aplicarse a la base real. Re-aplica ese mismo diseño.
drop policy if exists "admin_all_competitor_posts" on public.competitor_posts;
create policy "admin_all_competitor_posts" on public.competitor_posts
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and lower(p.role) = 'admin'
    )
  );

drop policy if exists "client_read_own_competitor_posts" on public.competitor_posts;
create policy "client_read_own_competitor_posts" on public.competitor_posts
  for select
  using (
    client_id in (
      select p.client_id from public.profiles p
      where p.id = auth.uid()
    )
  );
