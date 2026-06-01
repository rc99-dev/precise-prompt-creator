CREATE OR REPLACE FUNCTION public.cleanup_purchase_order_duplicate_items(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer := 0;
  can_cleanup boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = _order_id
      AND (
        po.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'comprador'::app_role)
        OR public.has_role(auth.uid(), 'aprovador'::app_role)
        OR public.has_role(auth.uid(), 'master'::app_role)
      )
  ) INTO can_cleanup;

  IF NOT can_cleanup THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY order_id, product_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.purchase_order_items
    WHERE order_id = _order_id
  ), deleted AS (
    DELETE FROM public.purchase_order_items poi
    USING ranked r
    WHERE poi.id = r.id
      AND r.rn > 1
    RETURNING poi.id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  UPDATE public.purchase_orders po
  SET total = COALESCE((
        SELECT sum(poi.subtotal)
        FROM public.purchase_order_items poi
        WHERE poi.order_id = _order_id
      ), 0),
      updated_at = now()
  WHERE po.id = _order_id;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_purchase_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_prevent_duplicate_purchase_order_item ON public.purchase_order_items;
CREATE TRIGGER trg_prevent_duplicate_purchase_order_item
BEFORE INSERT OR UPDATE OF order_id, product_id, quantidade, preco_unitario
ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_purchase_order_item();