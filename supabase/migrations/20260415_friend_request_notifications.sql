-- ============================================================
-- Migration: friend request notifications
-- ============================================================

-- 1. Replace direct friendship insert with an RPC that also creates a notification
CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
RETURNS uuid  -- returns friendship id
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_friendship_id uuid;
  v_sender_name   text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF v_user_id = p_addressee_id THEN RAISE EXCEPTION 'Você não pode adicionar a si mesmo.'; END IF;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = v_user_id AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Solicitação já enviada.';
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_user_id, p_addressee_id, 'pending')
  RETURNING id INTO v_friendship_id;

  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    p_addressee_id,
    'friend_request',
    json_build_object(
      'requester_id',   v_user_id,
      'requester_name', v_sender_name,
      'friendship_id',  v_friendship_id
    )
  );

  RETURN v_friendship_id;
END;
$$;

-- 2. Accept friend request — mark the related notification as read too
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE public.friendships
  SET status = 'accepted'
  WHERE id = p_friendship_id AND addressee_id = v_user_id;

  -- Mark any friend_request notification that references this friendship as read
  UPDATE public.notifications
  SET read = true
  WHERE user_id = v_user_id
    AND type = 'friend_request'
    AND (payload->>'friendship_id')::uuid = p_friendship_id;
END;
$$;
