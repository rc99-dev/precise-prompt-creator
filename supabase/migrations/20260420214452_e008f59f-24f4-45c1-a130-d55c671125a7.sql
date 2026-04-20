-- Comprador: gerenciar Produtos
CREATE POLICY "Comprador can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Comprador can update products"
ON public.products FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Comprador can delete products"
ON public.products FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role));

-- Comprador: gerenciar Fornecedores
CREATE POLICY "Comprador can insert suppliers"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Comprador can update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role));

CREATE POLICY "Comprador can delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'comprador'::app_role));

-- Assistente de Suprimentos (estoquista): gerenciar Preços
CREATE POLICY "Estoquista can insert prices"
ON public.supplier_prices FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'estoquista'::app_role));

CREATE POLICY "Estoquista can update prices"
ON public.supplier_prices FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'estoquista'::app_role));

CREATE POLICY "Estoquista can delete prices"
ON public.supplier_prices FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'estoquista'::app_role));