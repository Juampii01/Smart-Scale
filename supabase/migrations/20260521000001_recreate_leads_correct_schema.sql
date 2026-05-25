-- Recreate leads table with the schema the app expects
-- The previous table had wrong column names (full_name, stage, origin_angle, tags[])
-- This matches the API in /app/api/admin/leads/route.ts

DROP TABLE IF EXISTS public.leads CASCADE;

CREATE TABLE public.leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  email       text,
  tag         text,
  source      text,
  lead_type   text,
  status      text        NOT NULL DEFAULT 'nuevo',
  instagram   text,
  rating      integer     CHECK (rating BETWEEN 1 AND 5),
  niche       text,
  notes       text,
  raw_payload jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);
CREATE INDEX leads_status_idx     ON public.leads (status);
CREATE INDEX leads_rating_idx     ON public.leads (rating);
