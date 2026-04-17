-- Restrictive policy: block DELETE on purchase_orders unless status is rascunho or rejeitado
-- Applies to ALL roles including master (RESTRICTIVE policies are AND-combined with permissive ones)
CREATE POLICY "Block delete unless rascunho or rejeitado"
ON public.purchase_orders
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (status IN ('rascunho','rejeitado'));

-- Same protection for purchase_order_items: block deletion if parent order is not rascunho/rejeitado
CREATE POLICY "Block delete items unless parent rascunho or rejeitado"
ON public.purchase_order_items
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.order_id
    AND po.status IN ('rascunho','rejeitado')
));