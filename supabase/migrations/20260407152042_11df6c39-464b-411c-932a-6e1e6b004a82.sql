
-- Add titulo to requisitions
ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS titulo text;

-- Create requisition_items table
CREATE TABLE IF NOT EXISTS public.requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  saldo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solicitante inserts own items" ON public.requisition_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.requisitions WHERE id = requisition_items.requisition_id AND user_id = auth.uid())
  );

CREATE POLICY "Solicitante sees own items" ON public.requisition_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.requisitions WHERE id = requisition_items.requisition_id AND user_id = auth.uid())
  );

CREATE POLICY "Comprador sees all req items" ON public.requisition_items
  FOR SELECT USING (has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Master full access requisition items" ON public.requisition_items
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Add previsao_registrada_por to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS previsao_registrada_por uuid;

-- Comprador can see ALL orders
CREATE POLICY "Comprador can view all orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'comprador'::app_role));

-- Financeiro read-only policies
CREATE POLICY "Financeiro can view all orders" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro can view all order items" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro can view reports" ON public.reports
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role));
