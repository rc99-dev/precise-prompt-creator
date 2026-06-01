CREATE OR REPLACE FUNCTION public.prevent_duplicate_purchase_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.order_id::text || ':' || NEW.product_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.purchase_order_items poi
    WHERE poi.order_id = NEW.order_id
      AND poi.product_id = NEW.product_id
      AND (TG_OP = 'INSERT' OR poi.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Este produto já existe nesta ordem de compra. Atualize o item existente em vez de inserir outro.';
  END IF;

  NEW.subtotal := COALESCE(NEW.quantidade, 0) * COALESCE(NEW.preco_unitario, 0);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_duplicate_purchase_order_item() TO service_role;