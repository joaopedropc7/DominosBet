alter table public.profiles
add column if not exists display_name_updated_at timestamptz;

create unique index if not exists profiles_display_name_unique_idx
on public.profiles (lower(display_name));

create or replace function public.update_profile_identity(
  target_display_name text,
  target_avatar_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  normalized_name text;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

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
      select 1
      from public.profiles
      where lower(display_name) = lower(normalized_name)
        and id <> auth.uid()
    ) then
      raise exception 'Esse nome de jogador já está em uso.';
    end if;

    update public.profiles
    set
      display_name = normalized_name,
      avatar_id = target_avatar_id,
      display_name_updated_at = timezone('utc', now())
    where id = auth.uid();
  else
    update public.profiles
    set avatar_id = target_avatar_id
    where id = auth.uid();
  end if;
end;
$$;
