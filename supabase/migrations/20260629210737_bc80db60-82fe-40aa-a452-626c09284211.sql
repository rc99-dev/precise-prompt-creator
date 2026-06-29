CREATE OR REPLACE FUNCTION public.get_email_by_name(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email
  FROM public.profiles
  WHERE lower(trim(full_name)) = lower(trim(_name))
  LIMIT 1;
  RETURN _email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_name(text) TO anon, authenticated;