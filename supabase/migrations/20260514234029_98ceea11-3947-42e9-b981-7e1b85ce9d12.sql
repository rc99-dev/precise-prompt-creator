CREATE POLICY "Users delete own inventory log"
ON public.inventory_log FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::app_role));