
CREATE POLICY "Authenticated can view all orders"
  ON public.purchase_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view all order items"
  ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
