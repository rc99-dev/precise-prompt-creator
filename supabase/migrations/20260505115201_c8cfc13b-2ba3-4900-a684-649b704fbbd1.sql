ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS titulo text;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_titulo ON public.purchase_orders(titulo);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);