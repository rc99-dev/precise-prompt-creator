-- Add estado column to suppliers (item 2)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS estado text;

-- Inventories (item 1)
CREATE TABLE IF NOT EXISTS public.inventories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  categoria text,
  unidade text,
  setor text,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id uuid NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  saldo numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_id ON public.inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventories_user_id ON public.inventories(user_id);
CREATE INDEX IF NOT EXISTS idx_inventories_titulo ON public.inventories(titulo);

ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Inventories policies: any authenticated user can view all (shared catalog), owners and master/comprador can manage
CREATE POLICY "Authenticated can view inventories" ON public.inventories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own inventories" ON public.inventories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own inventories" ON public.inventories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Users delete own inventories" ON public.inventories
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'::app_role));

-- Inventory items policies: tied to parent inventory
CREATE POLICY "Authenticated can view inventory items" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert items in own inventories" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.inventories i WHERE i.id = inventory_id AND (i.user_id = auth.uid() OR has_role(auth.uid(), 'master'::app_role)))
  );

CREATE POLICY "Users update items in own inventories" ON public.inventory_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.inventories i WHERE i.id = inventory_id AND (i.user_id = auth.uid() OR has_role(auth.uid(), 'master'::app_role)))
  );

CREATE POLICY "Users delete items in own inventories" ON public.inventory_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.inventories i WHERE i.id = inventory_id AND (i.user_id = auth.uid() OR has_role(auth.uid(), 'master'::app_role)))
  );

-- updated_at trigger
CREATE TRIGGER trg_inventories_updated_at
BEFORE UPDATE ON public.inventories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();