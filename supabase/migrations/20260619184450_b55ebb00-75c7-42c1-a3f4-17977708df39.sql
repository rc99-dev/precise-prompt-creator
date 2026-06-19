
CREATE TABLE public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('orcamento','espelho','nota_fiscal','outro')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_attachments_order_id ON public.order_attachments(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attachments TO authenticated;
GRANT ALL ON public.order_attachments TO service_role;

ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_attachments_select_auth" ON public.order_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_attachments_insert_auth" ON public.order_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "order_attachments_delete_own_or_master" ON public.order_attachments
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_role(auth.uid(), 'comprador'::app_role)
  );

CREATE POLICY "order_attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-attachments');

CREATE POLICY "order_attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "order_attachments_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-attachments');
