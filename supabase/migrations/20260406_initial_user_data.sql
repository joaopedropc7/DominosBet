create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  rank_label text not null default 'Lendário',
  balance integer not null default 1250,
  level integer not null default 42,
  xp integer not null default 2450,
  xp_target integer not null default 3000,
  win_rate numeric(5,2) not null default 65,
  matches_count integer not null default 142,
  streak_label text not null default '5 vitórias',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  amount integer not null,
  highlight text not null default 'muted' check (highlight in ('gold', 'cyan', 'muted')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_name text not null,
  opponent_name text not null,
  result text not null check (result in ('win', 'loss')),
  reward integer not null default 0,
  score integer not null default 0,
  opponent_score integer not null default 0,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.increment_profile_after_victory(
  target_user_id uuid,
  reward_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    balance = balance + reward_amount,
    xp = xp + 120,
    matches_count = matches_count + 1,
    streak_label = 'Vitória recente'
  where id = target_user_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'Competidor'), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.match_history enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
create policy "wallet_transactions_select_own"
on public.wallet_transactions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "wallet_transactions_insert_own" on public.wallet_transactions;
create policy "wallet_transactions_insert_own"
on public.wallet_transactions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "match_history_select_own" on public.match_history;
create policy "match_history_select_own"
on public.match_history
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "match_history_insert_own" on public.match_history;
create policy "match_history_insert_own"
on public.match_history
for insert to authenticated
with check (auth.uid() = user_id);
