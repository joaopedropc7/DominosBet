alter table public.profiles
add column if not exists avatar_id text not null default 'gold-striker';
