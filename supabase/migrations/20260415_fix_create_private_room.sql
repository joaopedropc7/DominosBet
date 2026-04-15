-- Drop any existing overloads of create_private_room and recreate with p_mode
DROP FUNCTION IF EXISTS public.create_private_room(integer, text, text);
DROP FUNCTION IF EXISTS public.create_private_room(integer, text, text, text);

CREATE FUNCTION public.create_private_room(
  p_entry_fee  integer,
  p_mode       text    DEFAULT 'classic',
  p_password   text    DEFAULT NULL,
  p_room_name  text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_balance   integer;
  v_room_id   uuid;
  v_code      text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
  IF v_balance IS NULL OR v_balance < p_entry_fee THEN
    RAISE EXCEPTION 'Saldo insuficiente.';
  END IF;

  v_code := public.generate_invite_code();

  INSERT INTO public.match_rooms (
    player1_id, status, mode, entry_fee, pot,
    invite_code, room_password, room_name, is_private
  ) VALUES (
    v_user_id, 'waiting',
    CASE WHEN p_mode IN ('classic','express') THEN p_mode ELSE 'classic' END,
    p_entry_fee, 0,
    v_code,
    CASE WHEN p_password IS NOT NULL AND length(trim(p_password)) >= 4
         THEN trim(p_password) ELSE NULL END,
    NULLIF(trim(COALESCE(p_room_name, '')), ''),
    TRUE
  )
  RETURNING id INTO v_room_id;

  RETURN json_build_object('room_id', v_room_id, 'invite_code', v_code);
END;
$$;
