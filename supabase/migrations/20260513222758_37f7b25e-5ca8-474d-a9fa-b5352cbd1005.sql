-- B7: Estoquista pode gerenciar produtos
CREATE POLICY "Estoquista can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'estoquista'::app_role));

CREATE POLICY "Estoquista can update products"
ON public.products FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role));

-- B7: Estoquista pode gerenciar fornecedores
CREATE POLICY "Estoquista can insert suppliers"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'estoquista'::app_role));

CREATE POLICY "Estoquista can update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role));

-- B13: Estoquista vê todos os pedidos (libera visualização total)
DROP POLICY IF EXISTS "Estoquista views emitted orders" ON public.purchase_orders;
CREATE POLICY "Estoquista views all orders"
ON public.purchase_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role));

DROP POLICY IF EXISTS "Estoquista views emitted order items" ON public.purchase_order_items;
CREATE POLICY "Estoquista views all order items"
ON public.purchase_order_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role));

-- B18: Aprovador pode também atualizar pedidos já aprovados (correção)
DROP POLICY IF EXISTS "Aprovador can update orders" ON public.purchase_orders;
CREATE POLICY "Aprovador can update orders"
ON public.purchase_orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'aprovador'::app_role)
  AND status IN ('aguardando_aprovacao','aprovado','rejeitado')
)
WITH CHECK (
  public.has_role(auth.uid(), 'aprovador'::app_role)
  AND status IN ('aprovado','rejeitado','aguardando_aprovacao')
);