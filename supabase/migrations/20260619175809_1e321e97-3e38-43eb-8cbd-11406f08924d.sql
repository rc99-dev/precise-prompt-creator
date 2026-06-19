
-- =====================================================
-- MÓDULO PCP — Planejamento e Controle de Produção
-- =====================================================

-- 1) pcp_compras
CREATE TABLE public.pcp_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  categoria text NOT NULL,
  produto text NOT NULL,
  fornecedor text,
  peso_bruto_kg numeric,
  preco_unitario_kg numeric,
  total_pecas integer,
  valor_total_compra numeric,
  servico_compra numeric DEFAULT 0,
  servico_transporte numeric DEFAULT 0,
  gelo numeric DEFAULT 0,
  servico_filetamento numeric DEFAULT 0,
  custo_geral numeric,
  unidade_origem text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_compras TO authenticated;
GRANT ALL ON public.pcp_compras TO service_role;
ALTER TABLE public.pcp_compras ENABLE ROW LEVEL SECURITY;

-- 2) pcp_rendimento
CREATE TABLE public.pcp_rendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pcp_compra_id uuid REFERENCES public.pcp_compras(id) ON DELETE SET NULL,
  data date NOT NULL,
  fornecedor text,
  unidade text,
  tipo_produto text,
  peso_bruto_kg numeric,
  peso_liquido_kg numeric,
  casca_apara_kg numeric,
  perda_kg numeric,
  liquido_total_kg numeric,
  pct_casca numeric,
  pct_perda numeric,
  pct_rendimento numeric,
  rejeito_final_kg numeric,
  valor_inicial_kg numeric,
  valor_final_kg numeric,
  pct_acrescimo_valor numeric,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_rendimento TO authenticated;
GRANT ALL ON public.pcp_rendimento TO service_role;
ALTER TABLE public.pcp_rendimento ENABLE ROW LEVEL SECURITY;

-- 3) pcp_estoque_cdp
CREATE TABLE public.pcp_estoque_cdp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  produto text NOT NULL,
  estoque_inicial_kg numeric DEFAULT 0,
  entrada_kg numeric DEFAULT 0,
  saida_kg numeric DEFAULT 0,
  estoque_final_kg numeric,
  inventario_kg numeric,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_estoque_cdp TO authenticated;
GRANT ALL ON public.pcp_estoque_cdp TO service_role;
ALTER TABLE public.pcp_estoque_cdp ENABLE ROW LEVEL SECURITY;

-- 4) pcp_distribuicao
CREATE TABLE public.pcp_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  produto text NOT NULL,
  unidade_destino text NOT NULL,
  quantidade_kg numeric NOT NULL,
  custo_unitario_kg numeric,
  custo_total numeric,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_distribuicao TO authenticated;
GRANT ALL ON public.pcp_distribuicao TO service_role;
ALTER TABLE public.pcp_distribuicao ENABLE ROW LEVEL SECURITY;

-- 5) pcp_rateio
CREATE TABLE public.pcp_rateio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto text NOT NULL,
  unidade_devedora text NOT NULL,
  data_ref date NOT NULL,
  posta_frita_kg numeric DEFAULT 0,
  posta_chapa_kg numeric DEFAULT 0,
  isca_kg numeric DEFAULT 0,
  file_kg numeric DEFAULT 0,
  total_enviado_kg numeric,
  custo_frita numeric DEFAULT 0,
  custo_chapa numeric DEFAULT 0,
  custo_isca numeric DEFAULT 0,
  custo_file numeric DEFAULT 0,
  custo_final numeric,
  enviou_rateio boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_rateio TO authenticated;
GRANT ALL ON public.pcp_rateio TO service_role;
ALTER TABLE public.pcp_rateio ENABLE ROW LEVEL SECURITY;

-- 6) pcp_reembolsos
CREATE TABLE public.pcp_reembolsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_origem text NOT NULL,
  unidade_devedora text NOT NULL,
  data_ref date NOT NULL,
  data_solicitacao date,
  descritivo text NOT NULL,
  quantidade text,
  custo_final numeric,
  enviou_rateio boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_reembolsos TO authenticated;
GRANT ALL ON public.pcp_reembolsos TO service_role;
ALTER TABLE public.pcp_reembolsos ENABLE ROW LEVEL SECURITY;

-- 7) pcp_validades
CREATE TABLE public.pcp_validades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto text NOT NULL,
  lote text,
  unidade text NOT NULL,
  data_producao date,
  data_validade date NOT NULL,
  quantidade_kg numeric,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','atencao','vencido','descartado')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_validades TO authenticated;
GRANT ALL ON public.pcp_validades TO service_role;
ALTER TABLE public.pcp_validades ENABLE ROW LEVEL SECURITY;

-- 8) pcp_producao
CREATE TABLE public.pcp_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  produto text NOT NULL,
  unidade text NOT NULL,
  quantidade_produzida_kg numeric,
  quantidade_vendida_kg numeric,
  quantidade_descartada_kg numeric,
  pct_perda numeric,
  cmv_unitario numeric,
  cmv_total numeric,
  observacoes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcp_producao TO authenticated;
GRANT ALL ON public.pcp_producao TO service_role;
ALTER TABLE public.pcp_producao ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies (padrão para todas as tabelas PCP)
-- Leitura: todos autenticados | Inserção: autenticados (próprio user_id)
-- Edição/exclusão: dono ou master
-- =====================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pcp_compras','pcp_rendimento','pcp_estoque_cdp','pcp_distribuicao',
    'pcp_rateio','pcp_reembolsos','pcp_validades','pcp_producao'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format($p$
      CREATE POLICY "pcp_select_authenticated" ON public.%I
        FOR SELECT TO authenticated USING (true);
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "pcp_insert_own" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::app_role));
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "pcp_update_own_or_master" ON public.%I
        FOR UPDATE TO authenticated
        USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::app_role))
        WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::app_role));
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY "pcp_delete_own_or_master" ON public.%I
        FOR DELETE TO authenticated
        USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'master'::app_role));
    $p$, t);

    EXECUTE format($p$
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    $p$, t, t);
  END LOOP;
END $$;
