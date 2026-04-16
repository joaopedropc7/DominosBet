-- ============================================================
-- Auto-expiration of waiting rooms — Step 2: schedule cron job
--
-- PREREQUISITE: enable pg_cron BEFORE running this file.
--   Supabase Dashboard → Database → Extensions → "pg_cron" → Enable
--
-- After enabling, run this in the SQL editor.
-- ============================================================

SELECT cron.schedule(
  'expire-stale-rooms',
  '*/5 * * * *',
  'SELECT public.expire_stale_rooms()'
);
