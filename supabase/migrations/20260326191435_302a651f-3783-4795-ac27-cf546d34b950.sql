
-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unidade_setor text;

-- Add columns to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS grupo text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cidade text;

-- Product categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can manage categories" ON public.product_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Extend purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS emitted_at timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS unidade_setor text;

-- Requisitions
CREATE TABLE IF NOT EXISTS public.requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  saldo_atual numeric NOT NULL DEFAULT 0,
  unidade_medida text NOT NULL DEFAULT 'unidade',
  unidade_setor text,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente',
  motivo_recusa text,
  order_id uuid REFERENCES public.purchase_orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solicitante sees own" ON public.requisitions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Solicitante inserts own" ON public.requisitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comprador sees all requisitions" ON public.requisitions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'comprador'::app_role));
CREATE POLICY "Master sees all requisitions" ON public.requisitions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Comprador updates requisitions" ON public.requisitions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Master manages requisitions" ON public.requisitions FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Approval log
CREATE TABLE IF NOT EXISTS public.approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view approval log" ON public.approval_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Aprovador inserts log" ON public.approval_log FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'aprovador'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Quotations
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  estrategia text NOT NULL DEFAULT 'melhor_preco',
  observacoes text,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quotations" ON public.quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comprador manages quotations" ON public.quotations FOR ALL TO authenticated USING (has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Quotation items
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantidade numeric NOT NULL DEFAULT 1,
  supplier_id uuid REFERENCES public.suppliers(id),
  preco_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quotation items" ON public.quotation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comprador manages quotation items" ON public.quotation_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Receipts
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  user_id uuid NOT NULL,
  numero_nf text,
  status text NOT NULL DEFAULT 'aguardando',
  observacoes text,
  received_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles can view receipts" ON public.receipts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'estoquista'::app_role) OR has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'comprador'::app_role) OR has_role(auth.uid(), 'aprovador'::app_role));
CREATE POLICY "Estoquista manages receipts" ON public.receipts FOR ALL TO authenticated USING (has_role(auth.uid(), 'estoquista'::app_role) OR has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'estoquista'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Receipt items
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id),
  status text NOT NULL DEFAULT 'aguardando',
  quantidade_recebida numeric,
  tipo_ocorrencia text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View receipt items" ON public.receipt_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Estoquista manages receipt items" ON public.receipt_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'estoquista'::app_role) OR has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'estoquista'::app_role) OR has_role(auth.uid(), 'master'::app_role));

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "User updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  dados jsonb,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master sees reports" ON public.reports FOR SELECT TO authenticated USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Master manages reports" ON public.reports FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Update functions
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE current_year text; next_num INT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+$') AS INT)), 0) + 1 INTO next_num
  FROM public.purchase_orders WHERE numero LIKE 'PED-' || current_year || '-%';
  RETURN 'PED-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE current_year text; next_num INT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+$') AS INT)), 0) + 1 INTO next_num
  FROM public.quotations WHERE numero LIKE 'COT-' || current_year || '-%';
  RETURN 'COT-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE current_year text; next_num INT;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+$') AS INT)), 0) + 1 INTO next_num
  FROM public.receipts WHERE numero LIKE 'REC-' || current_year || '-%';
  RETURN 'REC-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'solicitante');
  RETURN NEW;
END; $$;

-- Additional RLS for new roles on purchase_orders
CREATE POLICY "Aprovador can view all orders" ON public.purchase_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'aprovador'::app_role));
CREATE POLICY "Aprovador can update orders" ON public.purchase_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'aprovador'::app_role));
CREATE POLICY "Master full access orders" ON public.purchase_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Estoquista views emitted orders" ON public.purchase_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'estoquista'::app_role) AND status IN ('emitido', 'recebido', 'recebido_com_ocorrencia'));

CREATE POLICY "Estoquista views emitted order items" ON public.purchase_order_items FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'estoquista'::app_role) AND EXISTS (
    SELECT 1 FROM purchase_orders WHERE id = purchase_order_items.order_id AND status IN ('emitido', 'recebido', 'recebido_com_ocorrencia')
  )
);

CREATE POLICY "Master full suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Master full products" ON public.products FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Master full prices" ON public.supplier_prices FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Comprador can insert prices" ON public.supplier_prices FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'comprador'::app_role));
CREATE POLICY "Comprador can update prices" ON public.supplier_prices FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'comprador'::app_role));
CREATE POLICY "Master manages all roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Insert default categories
INSERT INTO public.product_categories (nome) VALUES
  ('Açaí e Derivados'), ('Frutas'), ('Descartáveis'), ('Embalagens'),
  ('Ingredientes'), ('Bebidas'), ('Limpeza'), ('Utensílios'),
  ('Insumos Gerais'), ('Outros')
ON CONFLICT (nome) DO NOTHING;
