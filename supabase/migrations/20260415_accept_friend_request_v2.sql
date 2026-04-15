-- ============================================================
-- accept_friend_request v2
-- - Grants EXECUTE so authenticated users can call it
-- - Sends a friend_accepted notification to BOTH users
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_requester_id   uuid;
  v_acceptor_name  text;
  v_requester_name text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  -- Accept the friendship; only the addressee is allowed to accept
  UPDATE public.friendships
  SET    status = 'accepted'
  WHERE  id            = p_friendship_id
    AND  addressee_id  = v_user_id
    AND  status        = 'pending'
  RETURNING requester_id INTO v_requester_id;

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada.';
  END IF;

  -- Mark the incoming friend_request notification as read for the acceptor
  UPDATE public.notifications
  SET    read = true
  WHERE  user_id = v_user_id
    AND  type    = 'friend_request'
    AND  (payload->>'friendship_id')::uuid = p_friendship_id;

  -- Fetch display names
  SELECT display_name INTO v_acceptor_name  FROM public.profiles WHERE id = v_user_id;
  SELECT display_name INTO v_requester_name FROM public.profiles WHERE id = v_requester_id;

  -- Notify the requester: their request was accepted
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    v_requester_id,
    'friend_accepted',
    json_build_object(
      'friend_id',   v_user_id::text,
      'friend_name', v_acceptor_name
    )
  );

  -- Notify the acceptor: confirm you are now friends
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    v_user_id,
    'friend_accepted',
    json_build_object(
      'friend_id',   v_requester_id::text,
      'friend_name', v_requester_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
