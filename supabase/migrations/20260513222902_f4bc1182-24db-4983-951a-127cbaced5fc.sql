DROP POLICY IF EXISTS "Solicitante deletes own requisitions" ON public.requisitions;
CREATE POLICY "Solicitante deletes own requisitions"
ON public.requisitions FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status IN ('pendente','recusada'));

CREATE POLICY "Comprador deletes requisitions"
ON public.requisitions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'comprador'::app_role));