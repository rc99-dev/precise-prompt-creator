ALTER TABLE public.requisition_items 
ADD COLUMN pedido numeric NOT NULL DEFAULT 0,
ADD COLUMN observacoes text;