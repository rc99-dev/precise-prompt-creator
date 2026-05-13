
-- B1: Permite que usuários autenticados criem notificações para outros usuários
-- (necessário para fluxos: solicitação→comprador, ordem emitida→estoquista, aprovação→solicitante etc.)
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- B2: Estoquista pode atualizar pedidos emitidos para status de recebimento
DROP POLICY IF EXISTS "Estoquista can cancel emitted orders" ON public.purchase_orders;
CREATE POLICY "Estoquista updates emitted orders"
ON public.purchase_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'estoquista'::app_role) AND status = ANY(ARRAY['emitido','recebido','recebido_com_ocorrencia']))
WITH CHECK (has_role(auth.uid(), 'estoquista'::app_role) AND status = ANY(ARRAY['emitido','cancelado','recebido','recebido_com_ocorrencia']));

-- B3: Comprador pode atualizar qualquer pedido (marcar como emitido, editar etc.)
CREATE POLICY "Comprador updates orders"
ON public.purchase_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role))
WITH CHECK (has_role(auth.uid(), 'comprador'::app_role));

-- B4: Aprovador pode atualizar itens (ajustar quantidades durante aprovação)
CREATE POLICY "Aprovador updates order items"
ON public.purchase_order_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'aprovador'::app_role))
WITH CHECK (has_role(auth.uid(), 'aprovador'::app_role));

-- Comprador pode atualizar quaisquer itens também (necessário p/ editar pedidos não próprios)
CREATE POLICY "Comprador updates order items"
ON public.purchase_order_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role))
WITH CHECK (has_role(auth.uid(), 'comprador'::app_role));

-- Estoquista pode atualizar itens de pedidos emitidos (necessário em ajustes de recebimento)
CREATE POLICY "Estoquista updates emitted order items"
ON public.purchase_order_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'estoquista'::app_role) AND EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.order_id
    AND po.status = ANY(ARRAY['emitido','recebido','recebido_com_ocorrencia'])
))
WITH CHECK (has_role(auth.uid(), 'estoquista'::app_role));

-- B7: Financeiro pode ver recibos
DROP POLICY IF EXISTS "Roles can view receipts" ON public.receipts;
CREATE POLICY "Roles can view receipts"
ON public.receipts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'estoquista'::app_role)
  OR has_role(auth.uid(), 'master'::app_role)
  OR has_role(auth.uid(), 'comprador'::app_role)
  OR has_role(auth.uid(), 'aprovador'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

-- Financeiro também precisa ver receipt_items
-- (a policy "View receipt items" já é true, então OK)
