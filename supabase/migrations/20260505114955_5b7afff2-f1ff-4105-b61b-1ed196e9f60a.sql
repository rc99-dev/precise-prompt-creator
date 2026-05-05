-- ============================================================
-- BUG 1 & 2: Permissões em requisitions e requisition_items
-- ============================================================

-- Owner pode atualizar suas próprias requisitions (faltava UPDATE)
DROP POLICY IF EXISTS "Solicitante updates own requisitions" ON public.requisitions;
CREATE POLICY "Solicitante updates own requisitions"
ON public.requisitions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Solicitante deletes own requisitions" ON public.requisitions;
CREATE POLICY "Solicitante deletes own requisitions"
ON public.requisitions FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = 'pendente');

-- Estoquista pode ver/gerenciar requisitions também
DROP POLICY IF EXISTS "Estoquista manages requisitions" ON public.requisitions;
CREATE POLICY "Estoquista manages requisitions"
ON public.requisitions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'estoquista'::app_role));

-- ===== requisition_items =====
-- Owner: UPDATE / DELETE (faltavam)
DROP POLICY IF EXISTS "Solicitante updates own items" ON public.requisition_items;
CREATE POLICY "Solicitante updates own items"
ON public.requisition_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisitions r WHERE r.id = requisition_items.requisition_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.requisitions r WHERE r.id = requisition_items.requisition_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Solicitante deletes own items" ON public.requisition_items;
CREATE POLICY "Solicitante deletes own items"
ON public.requisition_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisitions r WHERE r.id = requisition_items.requisition_id AND r.user_id = auth.uid()));

-- Comprador: ALL
DROP POLICY IF EXISTS "Comprador manages requisition items" ON public.requisition_items;
CREATE POLICY "Comprador manages requisition items"
ON public.requisition_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'comprador'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'comprador'::app_role));

-- Estoquista: ALL
DROP POLICY IF EXISTS "Estoquista manages requisition items" ON public.requisition_items;
CREATE POLICY "Estoquista manages requisition items"
ON public.requisition_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'estoquista'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'estoquista'::app_role));

-- ============================================================
-- BUG 3: Função para buscar nomes (contornar RLS de profiles)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_profile_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;