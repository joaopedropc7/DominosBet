-- ═══════════════════════════════════════════════════════════════════════════
-- XDOMINO — ADMIN PANEL MIGRATION
-- Cole este arquivo no SQL Editor do Supabase e execute.
-- É idempotente (pode ser executado múltiplas vezes com segurança).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. COLUNA is_admin ────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ── 2. TABELAS DE AFILIADOS ───────────────────────────────────────────────

create table if not exists public.affiliate_links (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  code        text not null unique,
  label       text not null default '',
  bonus_coins integer not null default 100,
  uses_count  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.affiliate_uses (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.affiliate_links (id) on delete cascade,
  used_by    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint unique_affiliate_use unique (link_id, used_by)
);

create index if not exists affiliate_links_code_idx on public.affiliate_links (code);
create index if not exists affiliate_uses_link_idx  on public.affiliate_uses  (link_id);
create index if not exists affiliate_uses_user_idx  on public.affiliate_uses  (used_by);

-- ── 3. FUNÇÃO AUXILIAR: is_admin() ───────────────────────────────────────
-- security definer → runs as postgres (bypasses RLS) to avoid recursion.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ── 4. RLS PARA NOVAS TABELAS ─────────────────────────────────────────────

alter table public.affiliate_links enable row level security;
alter table public.affiliate_uses  enable row level security;

-- Admins gerenciam links; usuários não acessam diretamente
drop policy if exists "affiliate_links_admin_all" on public.affiliate_links;
create policy "affiliate_links_admin_all" on public.affiliate_links
  for all using (public.is_admin());

drop policy if exists "affiliate_uses_admin_select" on public.affiliate_uses;
create policy "affiliate_uses_admin_select" on public.affiliate_uses
  for select using (public.is_admin());

drop policy if exists "affiliate_uses_insert_own" on public.affiliate_uses;
create policy "affiliate_uses_insert_own" on public.affiliate_uses
  for insert with check (used_by = auth.uid());

-- ── 5. POLÍTICAS ADMIN PARA TABELAS EXISTENTES ───────────────────────────

-- Admins podem ver todos os perfis
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- Admins podem atualizar qualquer perfil
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- Admins podem ver todas as transações
drop policy if exists "wallet_transactions_select_admin" on public.wallet_transactions;
create policy "wallet_transactions_select_admin" on public.wallet_transactions
  for select using (public.is_admin());

drop policy if exists "wallet_transactions_insert_admin" on public.wallet_transactions;
create policy "wallet_transactions_insert_admin" on public.wallet_transactions
  for insert with check (public.is_admin());

-- Admins podem ver todo o histórico de partidas
drop policy if exists "match_history_select_admin" on public.match_history;
create policy "match_history_select_admin" on public.match_history
  for select using (public.is_admin());

-- ── 6. RPC: admin_get_dashboard ──────────────────────────────────────────

create or replace function public.admin_get_dashboard()
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select json_build_object(
    'total_users',        (select count(*) from public.profiles),
    'total_matches',      (select count(*) from public.match_history),
    'total_coins',        (select coalesce(sum(balance), 0) from public.profiles),
    'new_users_today',    (select count(*) from public.profiles
                            where created_at >= timezone('utc', now()) - interval '1 day'),
    'new_users_week',     (select count(*) from public.profiles
                            where created_at >= timezone('utc', now()) - interval '7 days'),
    'total_affiliates',   (select count(*) from public.affiliate_links),
    'affiliate_uses',     (select coalesce(sum(uses_count), 0) from public.affiliate_links)
  ) into result;

  return result;
end;
$$;

-- ── 7. RPC: admin_list_users ─────────────────────────────────────────────

create or replace function public.admin_list_users(
  search_term text    default '',
  page_offset integer default 0,
  page_limit  integer default 50
)
returns setof public.profiles language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  return query
    select * from public.profiles
    where (
      search_term = ''
      or lower(display_name) like '%' || lower(search_term) || '%'
      or lower(email)        like '%' || lower(search_term) || '%'
    )
    order by created_at desc
    limit page_limit
    offset page_offset;
end;
$$;

-- ── 8. RPC: admin_adjust_balance ─────────────────────────────────────────

create or replace function public.admin_adjust_balance(
  target_user_id uuid,
  amount         integer,  -- positive = crédito, negative = débito
  reason         text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  if amount = 0 then
    raise exception 'O valor do ajuste não pode ser zero.';
  end if;

  update public.profiles
  set balance = greatest(0, balance + amount)
  where id = target_user_id;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.wallet_transactions (user_id, title, description, amount, highlight)
  values (
    target_user_id,
    case when amount > 0 then 'Crédito Admin' else 'Débito Admin' end,
    reason,
    amount,
    case when amount > 0 then 'gold' else 'muted' end
  );
end;
$$;

-- ── 9. RPC: admin_set_ban ────────────────────────────────────────────────
-- Banir/desbanir: seta is_admin = false e adiciona coluna banned_at.
-- Por simplicidade usamos uma abordagem de "balance = -1" como flag,
-- mas o ideal é ter uma coluna is_banned. Adicionamos a coluna aqui:

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

create or replace function public.admin_set_ban(
  target_user_id uuid,
  ban            boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  update public.profiles
  set is_banned = ban
  where id = target_user_id;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;

-- ── 10. RPC: admin_create_affiliate_link ──────────────────────────────────

create or replace function public.admin_create_affiliate_link(
  link_code   text,
  link_label  text    default '',
  bonus       integer default 100
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  if length(trim(link_code)) < 3 then
    raise exception 'O código deve ter pelo menos 3 caracteres.';
  end if;

  insert into public.affiliate_links (created_by, code, label, bonus_coins)
  values (auth.uid(), trim(link_code), trim(link_label), bonus)
  returning id into new_id;

  return new_id;
end;
$$;

-- ── 11. RPC: admin_list_affiliate_links ───────────────────────────────────

create or replace function public.admin_list_affiliate_links()
returns table (
  id          uuid,
  code        text,
  label       text,
  bonus_coins integer,
  uses_count  integer,
  is_active   boolean,
  created_at  timestamptz,
  creator_name text
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  return query
    select
      al.id,
      al.code,
      al.label,
      al.bonus_coins,
      al.uses_count,
      al.is_active,
      al.created_at,
      p.display_name as creator_name
    from public.affiliate_links al
    join public.profiles p on p.id = al.created_by
    order by al.created_at desc;
end;
$$;

-- ── 12. RPC: admin_toggle_affiliate_link ──────────────────────────────────

create or replace function public.admin_toggle_affiliate_link(
  link_id uuid,
  active  boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  update public.affiliate_links
  set is_active = active
  where id = link_id;
end;
$$;
