
-- Add status, numero and authorization tracking to inventories
ALTER TABLE public.inventories
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS autorizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS autorizado_por uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill created_by from user_id
UPDATE public.inventories SET created_by = user_id WHERE created_by IS NULL;

-- Add solicitar_compra to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS solicitar_compra boolean NOT NULL DEFAULT false;

-- Generator for inventory numbers (INV-YYYY-####)
CREATE OR REPLACE FUNCTION public.generate_inventory_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE current_year text; next_num INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('inventories_numero_seq'));
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+$') AS INT)), 0) + 1
    INTO next_num
  FROM public.inventories
  WHERE numero LIKE 'INV-' || current_year || '-%';
  RETURN 'INV-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- Inventory log table for audit history
CREATE TABLE IF NOT EXISTS public.inventory_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_log_inv ON public.inventory_log(inventory_id);
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view inventory log" ON public.inventory_log;
CREATE POLICY "Authenticated can view inventory log"
ON public.inventory_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own inventory log" ON public.inventory_log;
CREATE POLICY "Users insert own inventory log"
ON public.inventory_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update inventories RLS: only owner (or master) can update; lock when enviado unless owner is reopening etc.
-- Existing policies allow owner+master update; we keep them. Add policy for master to view, already covered by "Authenticated can view".

-- Make titulo NOT NULL is already true. Make unidade NOT NULL after backfilling existing nulls.
UPDATE public.inventories SET unidade = 'NÃO INFORMADO' WHERE unidade IS NULL;
ALTER TABLE public.inventories ALTER COLUMN unidade SET NOT NULL;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
