CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  next_num INT;
BEGIN
  -- Lock para evitar duplicação em criações concorrentes (escopo: chave fixa para ordens)
  PERFORM pg_advisory_xact_lock(hashtext('purchase_orders_numero_seq'));

  current_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+$') AS INT)), 0) + 1
    INTO next_num
  FROM public.purchase_orders
  WHERE numero LIKE 'PED-' || current_year || '-%';

  RETURN 'PED-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$function$;