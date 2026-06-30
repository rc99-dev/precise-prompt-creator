REVOKE EXECUTE ON FUNCTION public.admin_update_email(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_email(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_email(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';