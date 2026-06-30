
-- admin_update_password: only master can reset a user's password
CREATE OR REPLACE FUNCTION public.admin_update_password(_user_id uuid, _new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden: only master can change passwords';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 6 THEN
    RAISE EXCEPTION 'password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_password(uuid, text) TO authenticated;

-- admin_create_user: only master can create users; also upserts when email exists
CREATE OR REPLACE FUNCTION public.admin_create_user(
  _email text,
  _password text,
  _full_name text,
  _unidade text,
  _setor text,
  _role app_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  existing_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden: only master can create users';
  END IF;
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  IF _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'password must be at least 6 characters';
  END IF;

  SELECT id INTO existing_user_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    -- Update existing: profile + role + status active
    UPDATE public.profiles
    SET full_name = COALESCE(_full_name, full_name),
        unidade = COALESCE(_unidade, unidade),
        unidade_setor = COALESCE(_setor, unidade_setor),
        status = 'ativo',
        updated_at = now()
    WHERE user_id = existing_user_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (existing_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Remove other roles to keep a single role per user (admin path)
    DELETE FROM public.user_roles WHERE user_id = existing_user_id AND role <> _role;

    RETURN existing_user_id;
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    lower(trim(_email)), crypt(_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', _full_name),
    now(), now(), '', '', '', ''
  );

  -- handle_new_user trigger creates profile + default role; update them to admin-provided values
  UPDATE public.profiles
  SET full_name = _full_name,
      unidade = _unidade,
      unidade_setor = _setor,
      status = 'ativo',
      updated_at = now()
  WHERE user_id = new_user_id;

  DELETE FROM public.user_roles WHERE user_id = new_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, _role);

  RETURN new_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, app_role) TO authenticated;
