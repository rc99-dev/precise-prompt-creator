DROP POLICY IF EXISTS "Aprovador can update orders" ON public.purchase_orders;
CREATE POLICY "Aprovador can update orders" ON public.purchase_orders
FOR UPDATE
USING (has_role(auth.uid(), 'aprovador'::app_role) AND (status = ANY (ARRAY['aguardando_aprovacao'::text, 'aprovado'::text, 'rejeitado'::text])))
WITH CHECK (has_role(auth.uid(), 'aprovador'::app_role) AND (status = ANY (ARRAY['aprovado'::text, 'rejeitado'::text, 'aguardando_aprovacao'::text, 'rascunho'::text])));