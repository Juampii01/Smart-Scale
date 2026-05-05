-- ============================================================================
-- Scope research/transcripts/video-feed por client_id (no más por user_id)
-- ============================================================================
-- Antes: cada user tenía su propio historial.
-- Ahora: cada cliente tiene su historial. Cuando admin navega como otro
-- cliente, ve y crea contenido para ESE cliente, no para el user logueado.
-- ============================================================================

-- ─── transcript_history ──────────────────────────────────────────────────────
alter table public.transcript_history
  add column if not exists client_id uuid;

update public.transcript_history th
   set client_id = p.client_id
  from public.profiles p
 where th.user_id = p.id
   and th.client_id is null;

create index if not exists transcript_history_client_id_idx
  on public.transcript_history (client_id);

-- ─── content_research_history ────────────────────────────────────────────────
alter table public.content_research_history
  add column if not exists client_id uuid;

update public.content_research_history crh
   set client_id = p.client_id
  from public.profiles p
 where crh.user_id = p.id
   and crh.client_id is null;

create index if not exists content_research_history_client_id_idx
  on public.content_research_history (client_id);

-- ─── video_feed_accounts ─────────────────────────────────────────────────────
-- Antes UNIQUE(user_id) → 1 cuenta IG por user.
-- Ahora UNIQUE(client_id) → 1 cuenta IG por cliente.
alter table public.video_feed_accounts
  add column if not exists client_id uuid;

update public.video_feed_accounts vfa
   set client_id = p.client_id
  from public.profiles p
 where vfa.user_id = p.id
   and vfa.client_id is null;

-- Drop la unique constraint vieja (si existe) y crear la nueva
alter table public.video_feed_accounts
  drop constraint if exists video_feed_accounts_user_id_key;

-- Solo crear la nueva unique si todos los rows tienen client_id no-null
do $$
begin
  if not exists (
    select 1 from public.video_feed_accounts where client_id is null
  ) then
    if not exists (
      select 1 from pg_constraint
       where conname = 'video_feed_accounts_client_id_unique'
    ) then
      alter table public.video_feed_accounts
        add constraint video_feed_accounts_client_id_unique unique (client_id);
    end if;
  end if;
end$$;

notify pgrst, 'reload schema';
