
-- Allow users to delete their own rejected orders
CREATE POLICY "Users can delete own rejected orders"
ON public.purchase_orders
FOR DELETE
USING (auth.uid() = user_id AND status = 'rejeitado');

-- Allow users to delete items of their own rejected orders
CREATE POLICY "Users can delete rejected order items"
ON public.purchase_order_items
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM purchase_orders
  WHERE purchase_orders.id = purchase_order_items.order_id
  AND purchase_orders.user_id = auth.uid()
  AND purchase_orders.status = 'rejeitado'
));
