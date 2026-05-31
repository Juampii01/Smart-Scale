-- Add nps_score column to monthly_reports
--
-- Context: The report-input form has had an NPS field (buttons 1–10) since
-- its inception, but the column never existed in the DB and the field was
-- silently dropped by the save route. This migration creates the column and
-- the save route is updated in the same PR to include it in NUMERIC_FIELDS.
--
-- Range: 1–10 (matches the [1,2,3,4,5,6,7,8,9,10] buttons in the form).
-- Nullable: existing rows stay NULL (no backfill needed — no data was ever
-- persisted, so there is nothing to lose).

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS nps_score smallint
    CHECK (nps_score BETWEEN 1 AND 10);

COMMENT ON COLUMN public.monthly_reports.nps_score IS
  'Net Promoter Score 1–10 filled by the client in the monthly report form.';
