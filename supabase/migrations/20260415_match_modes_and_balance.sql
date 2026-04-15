-- ============================================================
-- Match modes (classic / express) + initial balance 1250
-- ============================================================

-- 1. Add mode column to match_rooms
-- -------------------------------------------------------
alter table match_rooms
  add column if not exists mode text not null default 'classic';

-- 2. Update new-user default balance to 1250
-- -------------------------------------------------------
alter table profiles
  alter column balance set default 1250;

-- Bring existing users that still have the old 1000 default up to 1250
update profiles
  set balance = 1250
where balance = 1000;

-- 3. Update entry fee in existing waiting rooms (not strictly needed but keeps
--    data consistent with the new ENTRY_FEE constant of 20)
-- -------------------------------------------------------
update match_rooms
  set entry_fee = 20
where status = 'waiting';

-- 4. Replace join_matchmaking to filter by mode
-- -------------------------------------------------------
create or replace function join_matchmaking(p_mode text default 'classic')
returns jsonb
language plpgsql security definer as $$
declare
  v_uid        uuid := auth.uid();
  v_room_id    uuid;
  v_role       text;
  v_existing   uuid;
begin
  -- Already in an active room of this mode? Return it.
  select id into v_existing
    from match_rooms
   where (player1_id = v_uid or player2_id = v_uid)
     and status in ('waiting', 'playing')
     and mode = p_mode
   order by created_at desc
   limit 1;

  if found then
    select case when player1_id = v_uid then 'p1' else 'p2' end
      into v_role
      from match_rooms where id = v_existing;
    return jsonb_build_object('room_id', v_existing, 'role', v_role);
  end if;

  -- Look for a waiting room of the same mode created by someone else
  select id into v_room_id
    from match_rooms
   where status = 'waiting'
     and mode = p_mode
     and player2_id is null
     and player1_id != v_uid
   order by created_at asc
   limit 1
   for update skip locked;

  if found then
    -- Join as player 2 — caller starts match immediately
    update match_rooms
       set player2_id = v_uid,
           status     = 'playing'
     where id = v_room_id;
    return jsonb_build_object('room_id', v_room_id, 'role', 'p2');
  end if;

  -- Create a new waiting room for this mode
  insert into match_rooms (player1_id, mode, entry_fee)
  values (v_uid, p_mode, 20)
  returning id into v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'role', 'p1');
end;
$$;
