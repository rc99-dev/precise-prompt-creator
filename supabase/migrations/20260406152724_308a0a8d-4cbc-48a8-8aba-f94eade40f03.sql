
CREATE POLICY "Master can delete requisitions"
ON public.requisitions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'master'::app_role));
