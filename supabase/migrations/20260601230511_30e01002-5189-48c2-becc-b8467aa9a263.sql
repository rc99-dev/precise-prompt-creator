REVOKE ALL ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_purchase_order_duplicate_items(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_duplicate_purchase_order_item() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_duplicate_purchase_order_item() TO service_role;