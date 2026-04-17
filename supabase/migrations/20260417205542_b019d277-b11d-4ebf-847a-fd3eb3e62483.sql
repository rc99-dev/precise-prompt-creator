
-- 1. Restrict profiles SELECT: users see only their own profile; masters see all
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Master can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'::app_role));

-- 2. Scope realtime notifications per user
DROP POLICY IF EXISTS "Authenticated can read notifications topic" ON realtime.messages;
DROP POLICY IF EXISTS "user-notifications topic readable" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated read on notifications topic" ON realtime.messages;

-- Allow users to subscribe only to their own notification channel
CREATE POLICY "Users can read own notification topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user-notifications:' || auth.uid()::text)
);

-- 3. Harden notify_users: master-only + length limits
CREATE OR REPLACE FUNCTION public.notify_users(
  _target_role app_role,
  _titulo text,
  _mensagem text,
  _tipo text DEFAULT 'info'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden: only master can broadcast notifications';
  END IF;

  IF length(coalesce(_titulo, '')) > 200 THEN
    RAISE EXCEPTION 'titulo too long (max 200 chars)';
  END IF;

  IF length(coalesce(_mensagem, '')) > 1000 THEN
    RAISE EXCEPTION 'mensagem too long (max 1000 chars)';
  END IF;

  INSERT INTO public.notifications (user_id, titulo, mensagem, tipo, lida)
  SELECT ur.user_id, _titulo, _mensagem, _tipo, false
  FROM public.user_roles ur
  WHERE ur.role = _target_role;
END;
$function$;

-- New unauthenticated-safe function for signup notifications to masters
CREATE OR REPLACE FUNCTION public.notify_masters_new_signup(
  _titulo text,
  _mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF length(coalesce(_titulo, '')) > 200 THEN
    RAISE EXCEPTION 'titulo too long (max 200 chars)';
  END IF;

  IF length(coalesce(_mensagem, '')) > 1000 THEN
    RAISE EXCEPTION 'mensagem too long (max 1000 chars)';
  END IF;

  -- Only allow if caller has a profile in pendente status (i.e. just signed up)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'forbidden: only pending users can trigger signup notifications';
  END IF;

  INSERT INTO public.notifications (user_id, titulo, mensagem, tipo, lida)
  SELECT ur.user_id, _titulo, _mensagem, 'alerta', false
  FROM public.user_roles ur
  WHERE ur.role = 'master'::app_role;
END;
$function$;

-- 4. Remove redundant public-role policies on user_roles
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
