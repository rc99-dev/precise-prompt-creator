
CREATE OR REPLACE FUNCTION public.admin_update_email(_user_id uuid, _new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden: only master can change emails';
  END IF;
  IF _new_email IS NULL OR length(trim(_new_email)) = 0 THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  normalized_email := lower(trim(_new_email));
  IF normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email format';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = normalized_email AND id <> _user_id) THEN
    RAISE EXCEPTION 'email already in use';
  END IF;

  UPDATE auth.users
  SET email = normalized_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  UPDATE public.profiles
  SET email = normalized_email,
      updated_at = now()
  WHERE user_id = _user_id;
END;
$$;
