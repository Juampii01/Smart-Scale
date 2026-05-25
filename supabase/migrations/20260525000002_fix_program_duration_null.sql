-- Set program_duration = 6 for clients where it was never saved (NULL).
-- These were created via the onboarding form before the fix was applied.
UPDATE crm_clients
SET program_duration = 6
WHERE program_duration IS NULL;
