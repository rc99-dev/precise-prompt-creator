CREATE OR REPLACE FUNCTION public.get_email_by_name(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
BEGIN
  -- Resolve via auth.users using profiles.user_id to guarantee the real auth email
  SELECT u.email INTO _email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(trim(p.full_name)) = lower(trim(_name))
  LIMIT 1;

  -- Fallback to profiles.email if auth.users join didn't yield (shouldn't happen)
  IF _email IS NULL THEN
    SELECT email INTO _email
    FROM public.profiles
    WHERE lower(trim(full_name)) = lower(trim(_name))
    LIMIT 1;
  END IF;

  RETURN _email;
END;
$function$;