-- ═══════════════════════════════════════════════════════════════════════════
-- XDOMINO — SETUP COMPLETO DO BANCO DE DADOS
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- É idempotente (pode ser executado múltiplas vezes com segurança).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTENSÕES ─────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 2. TABELAS ────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text not null,
  display_name            text not null,
  display_name_updated_at timestamptz,
  avatar_id               text not null default 'gold-striker',
  rank_label              text not null default 'Lendário',
  balance                 integer not null default 1250,
  level                   integer not null default 42,
  xp                      integer not null default 2450,
  xp_target               integer not null default 3000,
  win_rate                numeric(5,2) not null default 65,
  matches_count           integer not null default 142,
  streak_label            text not null default '5 vitórias',
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

-- Nickname único (case-insensitive)
create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (lower(display_name));

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text not null,
  amount      integer not null,
  highlight   text not null default 'muted' check (highlight in ('gold', 'cyan', 'muted')),
  created_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.match_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  room_name        text not null,
  opponent_name    text not null,
  result           text not null check (result in ('win', 'loss')),
  reward           integer not null default 0,
  score            integer not null default 0,
  opponent_score   integer not null default 0,
  duration_seconds integer not null default 0,
  created_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  constraint no_self_friend check (requester_id <> addressee_id),
  constraint unique_pair     unique (requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

-- ── 3. TRIGGERS DE UPDATED_AT ─────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ── 4. TRIGGER: AUTO-CRIAR PERFIL AO CADASTRAR ────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name',
             split_part(coalesce(new.email, 'Competidor'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ── 5. FUNÇÕES RPC ────────────────────────────────────────────────────────

-- Incrementa stats após vitória
create or replace function public.increment_profile_after_victory(
  target_user_id uuid,
  reward_amount  integer
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set
    balance       = balance + reward_amount,
    xp            = xp + 120,
    matches_count = matches_count + 1,
    streak_label  = 'Vitória recente'
  where id = target_user_id;
end;
$$;

-- Atualiza nickname e avatar com validação e cooldown de 7 dias
create or replace function public.update_profile_identity(
  target_display_name text,
  target_avatar_id    text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_profile public.profiles%rowtype;
  normalized_name text;
begin
  select * into current_profile from public.profiles where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Perfil do usuário não encontrado.';
  end if;

  normalized_name := btrim(target_display_name);

  if normalized_name = '' then
    raise exception 'O nome do jogador é obrigatório.';
  end if;

  if char_length(normalized_name) < 3 then
    raise exception 'O nome do jogador deve ter pelo menos 3 caracteres.';
  end if;

  if current_profile.display_name is distinct from normalized_name then
    if current_profile.display_name_updated_at is not null
      and current_profile.display_name_updated_at > timezone('utc', now()) - interval '7 days' then
      raise exception 'Você só pode mudar seu nome uma vez a cada 7 dias.';
    end if;

    if exists (
      select 1 from public.profiles
      where lower(display_name) = lower(normalized_name)
        and id <> auth.uid()
    ) then
      raise exception 'Esse nome de jogador já está em uso.';
    end if;

    update public.profiles
    set
      display_name            = normalized_name,
      avatar_id               = target_avatar_id,
      display_name_updated_at = timezone('utc', now())
    where id = auth.uid();
  else
    update public.profiles set avatar_id = target_avatar_id where id = auth.uid();
  end if;
end;
$$;

-- Busca perfil por nickname exato (case-insensitive), exclui o próprio usuário
create or replace function public.find_profile_by_nickname(nickname text)
returns setof public.profiles language sql stable security definer as $$
  select * from public.profiles
  where lower(display_name) = lower(trim(nickname))
    and id <> auth.uid()
  limit 1;
$$;

-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.match_history       enable row level security;
alter table public.friendships         enable row level security;

-- profiles: usuário vê/edita apenas o próprio
drop policy if exists "profiles_select_own"  on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Amigos precisam ver o perfil um do outro
create policy "profiles_select_friend" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = id) or
          (addressee_id = auth.uid() and requester_id = id)
        )
    )
  );

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- wallet_transactions
drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
drop policy if exists "wallet_transactions_insert_own" on public.wallet_transactions;

create policy "wallet_transactions_select_own" on public.wallet_transactions
  for select to authenticated using (auth.uid() = user_id);

create policy "wallet_transactions_insert_own" on public.wallet_transactions
  for insert to authenticated with check (auth.uid() = user_id);

-- match_history
drop policy if exists "match_history_select_own" on public.match_history;
drop policy if exists "match_history_insert_own" on public.match_history;

create policy "match_history_select_own" on public.match_history
  for select to authenticated using (auth.uid() = user_id);

create policy "match_history_insert_own" on public.match_history
  for insert to authenticated with check (auth.uid() = user_id);

-- friendships
drop policy if exists "friendships_select"  on public.friendships;
drop policy if exists "friendships_insert"  on public.friendships;
drop policy if exists "friendships_update"  on public.friendships;
drop policy if exists "friendships_delete"  on public.friendships;

create policy "friendships_select" on public.friendships
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_insert" on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "friendships_update" on public.friendships
  for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_delete" on public.friendships
  for delete to authenticated
  using (auth.uid() = requester_id or public.friendships.addressee_id = auth.uid());
