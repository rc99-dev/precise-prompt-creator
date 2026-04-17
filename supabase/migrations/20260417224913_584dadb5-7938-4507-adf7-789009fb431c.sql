-- Allow master to cancel orders in any status (except already cancelled)
-- and allow estoquista to cancel orders in 'emitido' status (delivery did not arrive / was cancelled by supplier)

-- 1. Master: full UPDATE access already covered by 'Master full access orders'. No change needed.

-- 2. Estoquista: add policy to update emitido -> cancelado
CREATE POLICY "Estoquista can cancel emitted orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'estoquista'::app_role)
  AND status = 'emitido'
)
WITH CHECK (
  has_role(auth.uid(), 'estoquista'::app_role)
  AND status IN ('emitido', 'cancelado')
);
