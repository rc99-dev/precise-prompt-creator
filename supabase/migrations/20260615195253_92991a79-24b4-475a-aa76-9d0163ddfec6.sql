GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisitions TO authenticated;
GRANT ALL ON public.requisitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisition_items TO authenticated;
GRANT ALL ON public.requisition_items TO service_role;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;