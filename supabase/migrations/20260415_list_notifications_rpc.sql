-- RPC: list_notifications
-- Returns unread notifications for the current user via SECURITY DEFINER,
-- bypassing any RLS edge cases entirely.

CREATE OR REPLACE FUNCTION public.list_notifications()
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  type       text,
  payload    jsonb,
  read       boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, type, payload, read, created_at
  FROM   public.notifications
  WHERE  user_id = auth.uid()
    AND  read    = false
  ORDER  BY created_at DESC
  LIMIT  50;
$$;

GRANT EXECUTE ON FUNCTION public.list_notifications() TO authenticated;
