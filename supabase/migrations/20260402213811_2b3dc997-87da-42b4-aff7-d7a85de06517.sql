
-- Allow master to update any profile
CREATE POLICY "Master can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'master'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

-- Allow master to view and manage all order items
CREATE POLICY "Master full access order items"
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

-- Allow comprador to view all order items (for history)
CREATE POLICY "Comprador can view all order items"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'comprador'::app_role));

-- Allow aprovador to view all order items
CREATE POLICY "Aprovador can view all order items"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'aprovador'::app_role));
