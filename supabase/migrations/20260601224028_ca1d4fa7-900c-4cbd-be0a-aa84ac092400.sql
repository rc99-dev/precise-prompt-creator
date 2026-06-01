-- Relaxar a política restritiva para permitir aprovador/master excluir itens enquanto aguardando aprovação
DROP POLICY IF EXISTS "Block delete items unless parent rascunho or rejeitado" ON public.purchase_order_items;

CREATE POLICY "Block delete items unless allowed by status/role"
ON public.purchase_order_items
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id
      AND (
        po.status = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
        OR (
          po.status = 'aguardando_aprovacao'::text
          AND (public.has_role(auth.uid(), 'aprovador'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
        )
      )
  )
);

-- Política permissiva: aprovador pode deletar itens de ordens em aprovação
CREATE POLICY "Aprovador deletes items in pending orders"
ON public.purchase_order_items
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'aprovador'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id
      AND po.status = 'aguardando_aprovacao'::text
  )
);