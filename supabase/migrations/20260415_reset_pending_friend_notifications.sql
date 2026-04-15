-- Fix: unread friend_request notifications that were incorrectly marked as read.
-- This resets the read flag for any friend_request notification where
-- the corresponding friendship is still pending (i.e., not yet accepted/declined).

UPDATE public.notifications n
SET    read = false
FROM   public.friendships f
WHERE  n.type = 'friend_request'
  AND  (n.payload->>'friendship_id')::uuid = f.id
  AND  f.status = 'pending';
