-- ============================================================
-- Auto-expiration of waiting rooms — Step 1: function only
-- Run this first. For the cron schedule see:
--   20260416_auto_expire_rooms_cron.sql  (run AFTER enabling pg_cron)
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stale_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.match_rooms
  SET status = 'cancelled'
  WHERE status = 'waiting'
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_rooms() TO postgres;
