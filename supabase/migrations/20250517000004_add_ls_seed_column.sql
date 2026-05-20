-- Add missing ls_seed column to client_playbook_pages table
-- Check if table exists first, then add column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_playbook_pages') THEN
    ALTER TABLE public.client_playbook_pages
    ADD COLUMN IF NOT EXISTS ls_seed TEXT;

    CREATE INDEX IF NOT EXISTS idx_client_playbook_pages_ls_seed
    ON public.client_playbook_pages(ls_seed);
  END IF;
END $$;
