CREATE OR REPLACE FUNCTION public.get_email_by_name(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT au.email
  INTO user_email
  FROM auth.users au
  JOIN public.profiles p ON p.user_id = au.id
  WHERE lower(trim(p.full_name)) = lower(trim(_name))
  ORDER BY au.created_at DESC
  LIMIT 1;

  RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_name(text) TO anon, authenticated;