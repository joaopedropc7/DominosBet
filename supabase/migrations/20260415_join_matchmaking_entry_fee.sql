-- ============================================================
-- join_matchmaking: filter queue by mode AND entry_fee
-- Each combination is an isolated queue.
-- ============================================================

create or replace function join_matchmaking(
  p_mode       text    default 'classic',
  p_entry_fee  int     default 20
)
returns jsonb
language plpgsql security definer as $$
declare
  v_uid        uuid := auth.uid();
  v_room_id    uuid;
  v_role       text;
  v_existing   uuid;
begin
  -- Already in an active room of this mode + fee? Return it.
  select id into v_existing
    from match_rooms
   where (player1_id = v_uid or player2_id = v_uid)
     and status in ('waiting', 'playing')
     and mode = p_mode
     and entry_fee = p_entry_fee
   order by created_at desc
   limit 1;

  if found then
    select case when player1_id = v_uid then 'p1' else 'p2' end
      into v_role
      from match_rooms where id = v_existing;
    return jsonb_build_object('room_id', v_existing, 'role', v_role);
  end if;

  -- Look for a waiting room with the same mode + fee from someone else
  select id into v_room_id
    from match_rooms
   where status = 'waiting'
     and mode = p_mode
     and entry_fee = p_entry_fee
     and player2_id is null
     and player1_id != v_uid
   order by created_at asc
   limit 1
   for update skip locked;

  if found then
    update match_rooms
       set player2_id = v_uid,
           status     = 'playing'
     where id = v_room_id;
    return jsonb_build_object('room_id', v_room_id, 'role', 'p2');
  end if;

  -- Create new waiting room
  insert into match_rooms (player1_id, mode, entry_fee)
  values (v_uid, p_mode, p_entry_fee)
  returning id into v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'role', 'p1');
end;
$$;
