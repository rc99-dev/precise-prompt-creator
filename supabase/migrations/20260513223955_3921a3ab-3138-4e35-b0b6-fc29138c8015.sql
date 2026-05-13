
-- 1) Restrict notifications insert: self OR caller has elevated role OR target has elevated role (workflow)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Scoped notification insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'master'::app_role)
  OR public.has_role(auth.uid(), 'comprador'::app_role)
  OR public.has_role(auth.uid(), 'aprovador'::app_role)
  OR public.has_role(auth.uid(), 'estoquista'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = notifications.user_id
      AND ur.role IN ('master'::app_role,'comprador'::app_role,'aprovador'::app_role,'estoquista'::app_role,'financeiro'::app_role)
  )
);

-- 2) Profile self-update: prevent privilege escalation via permissoes_customizadas / status / role-relevant fields
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
  AND permissoes_customizadas IS NOT DISTINCT FROM (SELECT p.permissoes_customizadas FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 3) get_profile_names: add auth check + lock down execute
CREATE OR REPLACE FUNCTION public.get_profile_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name FROM public.profiles p WHERE p.user_id = ANY(_user_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_names(uuid[]) TO authenticated;

-- Lock down all SECURITY DEFINER functions from anon
REVOKE ALL ON FUNCTION public.get_profile_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_sensitive(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.list_profiles_for_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_profiles_for_master() TO authenticated;
REVOKE ALL ON FUNCTION public.notify_masters_new_signup(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_masters_new_signup(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.notify_users(app_role, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_users(app_role, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 4) Restrict solicitante requisition updates to pendente status (cannot self-escalate)
DROP POLICY IF EXISTS "Solicitante updates own requisitions" ON public.requisitions;
CREATE POLICY "Solicitante updates own pending requisitions"
ON public.requisitions FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pendente')
WITH CHECK (auth.uid() = user_id AND status = 'pendente');

-- 5) Realtime: drop wildcard topic policy if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'
      AND policyname='Users subscribe to own notifications topic'
  ) THEN
    EXECUTE 'DROP POLICY "Users subscribe to own notifications topic" ON realtime.messages';
  END IF;
END $$;
