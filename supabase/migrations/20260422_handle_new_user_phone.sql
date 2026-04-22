-- Atualiza handle_new_user para salvar o telefone passado no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, phone)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'Competidor'), '@', 1)),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;
