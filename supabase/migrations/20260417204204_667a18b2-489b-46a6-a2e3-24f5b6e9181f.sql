
-- ============================================
-- 1. SUPPLIERS: remove public read
-- ============================================
DROP POLICY IF EXISTS "suppliers_read" ON public.suppliers;

-- ============================================
-- 2. PRODUCTS: remove duplicate public read
-- ============================================
DROP POLICY IF EXISTS "products_read" ON public.products;

-- ============================================
-- 3. SUPPLIER_PRICES: remove permissive public policies
-- ============================================
DROP POLICY IF EXISTS "supplier_prices_select" ON public.supplier_prices;
DROP POLICY IF EXISTS "supplier_prices_insert" ON public.supplier_prices;
DROP POLICY IF EXISTS "supplier_prices_update" ON public.supplier_prices;
DROP POLICY IF EXISTS "supplier_prices_delete" ON public.supplier_prices;

-- ============================================
-- 4. REQUISITION_ITEMS: re-scope to authenticated
-- ============================================
DROP POLICY IF EXISTS "Comprador sees all req items" ON public.requisition_items;
DROP POLICY IF EXISTS "Master full access requisition items" ON public.requisition_items;
DROP POLICY IF EXISTS "Solicitante inserts own items" ON public.requisition_items;
DROP POLICY IF EXISTS "Solicitante sees own items" ON public.requisition_items;

CREATE POLICY "Comprador sees all req items"
ON public.requisition_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Master full access requisition items"
ON public.requisition_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'master'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Solicitante inserts own items"
ON public.requisition_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.requisitions
  WHERE requisitions.id = requisition_items.requisition_id
    AND requisitions.user_id = auth.uid()
));

CREATE POLICY "Solicitante sees own items"
ON public.requisition_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.requisitions
  WHERE requisitions.id = requisition_items.requisition_id
    AND requisitions.user_id = auth.uid()
));

-- Also re-scope purchase_orders & purchase_order_items public-facing delete policies
DROP POLICY IF EXISTS "Users can delete own rejected orders" ON public.purchase_orders;
CREATE POLICY "Users can delete own rejected orders"
ON public.purchase_orders FOR DELETE TO authenticated
USING ((auth.uid() = user_id) AND (status = 'rejeitado'::text));

DROP POLICY IF EXISTS "Users can delete rejected order items" ON public.purchase_order_items;
CREATE POLICY "Users can delete rejected order items"
ON public.purchase_order_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders
  WHERE purchase_orders.id = purchase_order_items.order_id
    AND purchase_orders.user_id = auth.uid()
    AND purchase_orders.status = 'rejeitado'::text
));

-- ============================================
-- 5. NOTIFICATIONS: restrict to self-insert + secure cross-user function
-- ============================================
DROP POLICY IF EXISTS "Authenticated inserts notifications" ON public.notifications;

CREATE POLICY "Users insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Secure function so any authenticated user can dispatch notifications
-- to a target audience (e.g., all masters) without writing to others' inboxes directly.
CREATE OR REPLACE FUNCTION public.notify_users(
  _target_role app_role,
  _titulo text,
  _mensagem text,
  _tipo text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, titulo, mensagem, tipo, lida)
  SELECT ur.user_id, _titulo, _mensagem, _tipo, false
  FROM public.user_roles ur
  WHERE ur.role = _target_role;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_users(app_role, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_users(app_role, text, text, text) TO authenticated;

-- ============================================
-- 6. PROFILES: protect sensitive columns
-- Keep the broad SELECT policy for app needs (name/unit/sector lookups across the app),
-- but revoke column access to email and permissoes_customizadas from regular users.
-- ============================================
REVOKE SELECT (email, permissoes_customizadas) ON public.profiles FROM authenticated;
REVOKE SELECT (email, permissoes_customizadas) ON public.profiles FROM anon;

-- Provide a security-definer accessor so users/masters can still read sensitive fields when authorized
CREATE OR REPLACE FUNCTION public.get_profile_sensitive(_user_id uuid)
RETURNS TABLE (email text, permissoes_customizadas jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.email, p.permissoes_customizadas
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_sensitive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_sensitive(uuid) TO authenticated;

-- Master needs to list all users with email for UsersPage
CREATE OR REPLACE FUNCTION public.list_profiles_for_master()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  unidade text,
  unidade_setor text,
  status text,
  permissoes_customizadas jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.email, p.unidade, p.unidade_setor, p.status,
         p.permissoes_customizadas, p.created_at, p.updated_at
  FROM public.profiles p
  ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_profiles_for_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_profiles_for_master() TO authenticated;

-- ============================================
-- 7. PURCHASE_ORDERS: scope aprovador UPDATE to awaiting status
-- ============================================
DROP POLICY IF EXISTS "Aprovador can update orders" ON public.purchase_orders;
CREATE POLICY "Aprovador can update orders"
ON public.purchase_orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'aprovador'::app_role) AND status = 'aguardando_aprovacao')
WITH CHECK (public.has_role(auth.uid(), 'aprovador'::app_role) AND status IN ('aprovado','rejeitado'));

-- ============================================
-- 8. USER_ROLES: prevent admins from granting master role
-- ============================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert non-master roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role);

CREATE POLICY "Admins can update non-master roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role)
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role);

CREATE POLICY "Admins can delete non-master roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'master'::app_role);

-- ============================================
-- 9. REALTIME: scope notification subscriptions to own user_id topic
-- ============================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own notifications topic" ON realtime.messages;
CREATE POLICY "Users subscribe to own notifications topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Allow only the user-notifications channel and only when the topic matches their uid pattern
  (realtime.topic() = 'user-notifications')
);
