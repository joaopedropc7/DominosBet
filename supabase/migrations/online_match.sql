-- ============================================================
-- Online 1v1 multiplayer: match_rooms table + RPCs
-- ============================================================

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
create table if not exists match_rooms (
  id               uuid        primary key default gen_random_uuid(),
  status           text        not null default 'waiting',  -- 'waiting' | 'playing' | 'finished'
  player1_id       uuid        not null references profiles(id) on delete cascade,
  player2_id       uuid        references profiles(id) on delete cascade,
  current_turn_id  uuid        references profiles(id),
  game_state       jsonb       not null default '{}'::jsonb,
  winner_id        uuid        references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function touch_match_room()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger match_rooms_updated_at
  before update on match_rooms
  for each row execute function touch_match_room();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table match_rooms enable row level security;

create policy "players can read their room"
  on match_rooms for select
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- All mutations go through security-definer RPCs

-- ------------------------------------------------------------
-- Enable Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table match_rooms;

-- ------------------------------------------------------------
-- RPC: join_matchmaking
-- Finds an open waiting room or creates one.
-- Returns: { room_id uuid, role text ('p1'|'p2') }
-- ------------------------------------------------------------
create or replace function join_matchmaking()
returns jsonb
language plpgsql security definer as $$
declare
  v_uid        uuid := auth.uid();
  v_room_id    uuid;
  v_role       text;
  v_existing   uuid;
begin
  -- Already in an active room? Return it.
  select id into v_existing
    from match_rooms
   where (player1_id = v_uid or player2_id = v_uid)
     and status in ('waiting', 'playing')
   order by created_at desc
   limit 1;

  if found then
    select case when player1_id = v_uid then 'p1' else 'p2' end
      into v_role
      from match_rooms where id = v_existing;
    return jsonb_build_object('room_id', v_existing, 'role', v_role);
  end if;

  -- Look for a waiting room created by someone else
  select id into v_room_id
    from match_rooms
   where status = 'waiting'
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

  -- Create a new waiting room
  insert into match_rooms (player1_id)
    values (v_uid)
    returning id into v_room_id;

  return jsonb_build_object('room_id', v_room_id, 'role', 'p1');
end;
$$;

-- ------------------------------------------------------------
-- RPC: start_online_match
-- Called by p2 after joining to push the initial game state.
-- current_turn_id is passed so server records whose turn it is.
-- ------------------------------------------------------------
create or replace function start_online_match(
  room_id          uuid,
  initial_state    jsonb,
  first_turn_id    uuid   -- the Supabase user ID whose turn goes first
)
returns void
language plpgsql security definer as $$
declare
  v_room match_rooms%rowtype;
begin
  select * into v_room from match_rooms where id = room_id for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.player2_id != auth.uid() then
    raise exception 'Only player 2 starts the match';
  end if;

  if v_room.status != 'playing' then
    raise exception 'Room is not in playing state';
  end if;

  update match_rooms
     set game_state      = initial_state,
         current_turn_id = first_turn_id
   where id = room_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: make_move_online
-- Validates turn ownership, stores new game state.
-- flip_turn = false when the player draws a tile (stays their turn).
-- ------------------------------------------------------------
create or replace function make_move_online(
  room_id        uuid,
  new_state      jsonb,
  flip_turn      boolean default true
)
returns void
language plpgsql security definer as $$
declare
  v_room match_rooms%rowtype;
  v_next_turn uuid;
  v_winner    uuid;
  v_status    text;
begin
  select * into v_room from match_rooms where id = room_id for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.current_turn_id is distinct from auth.uid() then
    raise exception 'Not your turn';
  end if;

  if v_room.status != 'playing' then
    raise exception 'Match is not in progress';
  end if;

  -- Determine next turn
  if flip_turn then
    v_next_turn := case
      when v_room.current_turn_id = v_room.player1_id then v_room.player2_id
      else v_room.player1_id
    end;
  else
    v_next_turn := v_room.current_turn_id;
  end if;

  -- Derive status and winner from the game state payload
  v_status := coalesce(new_state->>'status', 'playing');

  if v_status = 'finished' then
    declare
      v_winner_role text := new_state->'result'->>'winner';
    begin
      v_winner := case v_winner_role
        when 'p1' then v_room.player1_id
        when 'p2' then v_room.player2_id
        else null  -- draw
      end;
    end;
  end if;

  update match_rooms
     set game_state      = new_state,
         current_turn_id = v_next_turn,
         status          = v_status,
         winner_id       = v_winner
   where id = room_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: abandon_match
-- Forfeits — the other player wins.
-- ------------------------------------------------------------
create or replace function abandon_match(room_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_room match_rooms%rowtype;
  v_winner uuid;
begin
  select * into v_room from match_rooms where id = room_id for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.player1_id != auth.uid() and v_room.player2_id != auth.uid() then
    raise exception 'You are not in this room';
  end if;

  if v_room.status = 'finished' then
    return;
  end if;

  v_winner := case
    when auth.uid() = v_room.player1_id then v_room.player2_id
    else v_room.player1_id
  end;

  update match_rooms
     set status    = 'finished',
         winner_id = v_winner
   where id = room_id;
end;
$$;

-- ------------------------------------------------------------
-- RPC: leave_matchmaking
-- Cancels a waiting room created by the caller.
-- ------------------------------------------------------------
create or replace function leave_matchmaking(room_id uuid)
returns void
language plpgsql security definer as $$
begin
  delete from match_rooms
   where id = room_id
     and player1_id = auth.uid()
     and status = 'waiting';
end;
$$;
