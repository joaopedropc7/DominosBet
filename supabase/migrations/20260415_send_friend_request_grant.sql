-- Recreate send_friend_request with explicit GRANT EXECUTE and SET search_path.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_friendship_id uuid;
  v_sender_name   text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF v_user_id = p_addressee_id THEN RAISE EXCEPTION 'Você não pode adicionar a si mesmo.'; END IF;

  -- Prevent duplicate requests in either direction
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
      'requester_id',   v_user_id::text,
      'requester_name', v_sender_name,
      'friendship_id',  v_friendship_id::text
    )
  );

  RETURN v_friendship_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
