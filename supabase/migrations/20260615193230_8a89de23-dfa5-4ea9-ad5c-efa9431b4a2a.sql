-- Liberar SELECT de requisitions e requisition_items para todos os usuários autenticados.
-- Edição/exclusão continua restrita pelas políticas existentes.

DROP POLICY IF EXISTS "Authenticated can view requisitions" ON public.requisitions;
CREATE POLICY "Authenticated can view requisitions"
  ON public.requisitions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can view requisition items" ON public.requisition_items;
CREATE POLICY "Authenticated can view requisition items"
  ON public.requisition_items FOR SELECT
  TO authenticated
  USING (true);