ALTER TABLE public.requisition_items
  ADD COLUMN IF NOT EXISTS destino text,
  ADD COLUMN IF NOT EXISTS triagem_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS triagem_por uuid;

ALTER TABLE public.requisition_items
  DROP CONSTRAINT IF EXISTS requisition_items_destino_check;
ALTER TABLE public.requisition_items
  ADD CONSTRAINT requisition_items_destino_check
  CHECK (destino IS NULL OR destino IN ('comprador','pcp'));

CREATE INDEX IF NOT EXISTS idx_requisition_items_destino
  ON public.requisition_items(destino);