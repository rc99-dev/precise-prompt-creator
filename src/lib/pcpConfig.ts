import { UNIDADES } from "@/lib/constants";

export type PcpFieldType = "text" | "number" | "date" | "select" | "boolean" | "textarea";

export type PcpField = {
  name: string;
  label: string;
  type: PcpFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  step?: string;
  showInTable?: boolean;
  isCurrency?: boolean;
  /** Computed before save: receives full form values, returns numeric value */
  compute?: (values: Record<string, any>) => number | null;
};

export type PcpCrudConfig = {
  table:
    | "pcp_compras"
    | "pcp_rendimento"
    | "pcp_estoque_cdp"
    | "pcp_distribuicao"
    | "pcp_rateio"
    | "pcp_reembolsos"
    | "pcp_validades"
    | "pcp_producao";
  title: string;
  description: string;
  fields: PcpField[];
  orderBy?: { column: string; ascending?: boolean };
};

const unidadeOptions = UNIDADES.map((u) => ({ value: u, label: u }));

const CATEGORIAS_PCP = ["PEIXE", "CAMARÃO", "FRUTOS DO MAR", "AVES", "BOVINO", "SUÍNO", "OUTROS"];
const catOptions = CATEGORIAS_PCP.map((c) => ({ value: c, label: c }));

const STATUS_VALIDADE = [
  { value: "ok", label: "OK" },
  { value: "atencao", label: "Atenção" },
  { value: "vencido", label: "Vencido" },
  { value: "descartado", label: "Descartado" },
];

// =====================  COMPRAS  =====================
export const comprasConfig: PcpCrudConfig = {
  table: "pcp_compras",
  title: "Compras de Produção",
  description: "Registro de compras de proteínas (peixe, camarão, etc) com custo total e serviços",
  orderBy: { column: "data", ascending: false },
  fields: [
    { name: "data", label: "Data", type: "date", required: true, showInTable: true },
    { name: "categoria", label: "Categoria", type: "select", options: catOptions, required: true, showInTable: true },
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    { name: "fornecedor", label: "Fornecedor", type: "text", showInTable: true },
    { name: "unidade_origem", label: "Unidade de Origem", type: "select", options: unidadeOptions },
    { name: "peso_bruto_kg", label: "Peso Bruto (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "preco_unitario_kg", label: "Preço Unit. (R$/kg)", type: "number", step: "0.01", isCurrency: true },
    { name: "total_pecas", label: "Total de Peças", type: "number", step: "1" },
    {
      name: "valor_total_compra",
      label: "Valor Total Compra (R$)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) =>
        v.peso_bruto_kg && v.preco_unitario_kg
          ? Number(v.peso_bruto_kg) * Number(v.preco_unitario_kg)
          : v.valor_total_compra ?? null,
    },
    { name: "servico_compra", label: "Serviço de Compra (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "servico_transporte", label: "Serviço Transporte (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "gelo", label: "Gelo (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "servico_filetamento", label: "Serviço Filetamento (R$)", type: "number", step: "0.01", isCurrency: true },
    {
      name: "custo_geral",
      label: "Custo Geral (R$)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) => {
        const total =
          (Number(v.valor_total_compra) || (Number(v.peso_bruto_kg) || 0) * (Number(v.preco_unitario_kg) || 0)) +
          (Number(v.servico_compra) || 0) +
          (Number(v.servico_transporte) || 0) +
          (Number(v.gelo) || 0) +
          (Number(v.servico_filetamento) || 0);
        return total || null;
      },
    },
  ],
};

// =====================  RENDIMENTO  =====================
export const rendimentoConfig: PcpCrudConfig = {
  table: "pcp_rendimento",
  title: "Rendimento / Beneficiamento",
  description: "Controle de rendimento por lote: peso bruto vs líquido, perda e acréscimo de valor",
  orderBy: { column: "data", ascending: false },
  fields: [
    { name: "data", label: "Data", type: "date", required: true, showInTable: true },
    { name: "fornecedor", label: "Fornecedor", type: "text", showInTable: true },
    { name: "unidade", label: "Unidade", type: "select", options: unidadeOptions, showInTable: true },
    { name: "tipo_produto", label: "Tipo de Produto", type: "text", showInTable: true },
    { name: "peso_bruto_kg", label: "Peso Bruto (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "peso_liquido_kg", label: "Peso Líquido (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "casca_apara_kg", label: "Casca/Apara (kg)", type: "number", step: "0.001" },
    { name: "perda_kg", label: "Perda (kg)", type: "number", step: "0.001" },
    { name: "rejeito_final_kg", label: "Rejeito Final (kg)", type: "number", step: "0.001" },
    {
      name: "liquido_total_kg",
      label: "Líquido Total (kg)",
      type: "number",
      step: "0.001",
      compute: (v) => (Number(v.peso_liquido_kg) || 0) - (Number(v.rejeito_final_kg) || 0) || null,
    },
    {
      name: "pct_casca",
      label: "% Casca",
      type: "number",
      step: "0.01",
      compute: (v) =>
        v.peso_bruto_kg && v.casca_apara_kg
          ? (Number(v.casca_apara_kg) / Number(v.peso_bruto_kg)) * 100
          : null,
    },
    {
      name: "pct_perda",
      label: "% Perda",
      type: "number",
      step: "0.01",
      compute: (v) =>
        v.peso_bruto_kg && v.perda_kg ? (Number(v.perda_kg) / Number(v.peso_bruto_kg)) * 100 : null,
    },
    {
      name: "pct_rendimento",
      label: "% Rendimento",
      type: "number",
      step: "0.01",
      showInTable: true,
      compute: (v) =>
        v.peso_bruto_kg && v.peso_liquido_kg
          ? (Number(v.peso_liquido_kg) / Number(v.peso_bruto_kg)) * 100
          : null,
    },
    { name: "valor_inicial_kg", label: "Valor Inicial (R$/kg)", type: "number", step: "0.01", isCurrency: true },
    {
      name: "valor_final_kg",
      label: "Valor Final (R$/kg)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) =>
        v.valor_inicial_kg && v.peso_bruto_kg && v.peso_liquido_kg
          ? (Number(v.valor_inicial_kg) * Number(v.peso_bruto_kg)) / Number(v.peso_liquido_kg)
          : null,
    },
    {
      name: "pct_acrescimo_valor",
      label: "% Acréscimo Valor",
      type: "number",
      step: "0.01",
      compute: (v) => {
        const vi = Number(v.valor_inicial_kg);
        const vf =
          Number(v.valor_final_kg) ||
          (vi && v.peso_bruto_kg && v.peso_liquido_kg
            ? (vi * Number(v.peso_bruto_kg)) / Number(v.peso_liquido_kg)
            : 0);
        return vi && vf ? ((vf - vi) / vi) * 100 : null;
      },
    },
  ],
};

// =====================  ESTOQUE CDP  =====================
export const estoqueConfig: PcpCrudConfig = {
  table: "pcp_estoque_cdp",
  title: "Estoque Central (CDP)",
  description: "Saldo diário da Central de Distribuição de Proteínas",
  orderBy: { column: "data", ascending: false },
  fields: [
    { name: "data", label: "Data", type: "date", required: true, showInTable: true },
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    { name: "estoque_inicial_kg", label: "Estoque Inicial (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "entrada_kg", label: "Entrada (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "saida_kg", label: "Saída (kg)", type: "number", step: "0.001", showInTable: true },
    {
      name: "estoque_final_kg",
      label: "Estoque Final (kg)",
      type: "number",
      step: "0.001",
      showInTable: true,
      compute: (v) =>
        (Number(v.estoque_inicial_kg) || 0) + (Number(v.entrada_kg) || 0) - (Number(v.saida_kg) || 0),
    },
    { name: "inventario_kg", label: "Inventário (kg)", type: "number", step: "0.001" },
  ],
};

// =====================  DISTRIBUIÇÃO  =====================
export const distribuicaoConfig: PcpCrudConfig = {
  table: "pcp_distribuicao",
  title: "Distribuição entre Unidades",
  description: "Envios da Central de Distribuição para cada unidade",
  orderBy: { column: "data", ascending: false },
  fields: [
    { name: "data", label: "Data", type: "date", required: true, showInTable: true },
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    {
      name: "unidade_destino",
      label: "Unidade Destino",
      type: "select",
      options: unidadeOptions,
      required: true,
      showInTable: true,
    },
    { name: "quantidade_kg", label: "Quantidade (kg)", type: "number", step: "0.001", required: true, showInTable: true },
    { name: "custo_unitario_kg", label: "Custo Unit. (R$/kg)", type: "number", step: "0.01", isCurrency: true },
    {
      name: "custo_total",
      label: "Custo Total (R$)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) =>
        v.quantidade_kg && v.custo_unitario_kg
          ? Number(v.quantidade_kg) * Number(v.custo_unitario_kg)
          : null,
    },
  ],
};

// =====================  RATEIO  =====================
export const rateioConfig: PcpCrudConfig = {
  table: "pcp_rateio",
  title: "Rateio de Custos",
  description: "Rateio de custos entre unidades por tipo de corte",
  orderBy: { column: "data_ref", ascending: false },
  fields: [
    { name: "data_ref", label: "Data Referência", type: "date", required: true, showInTable: true },
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    {
      name: "unidade_devedora",
      label: "Unidade Devedora",
      type: "select",
      options: unidadeOptions,
      required: true,
      showInTable: true,
    },
    { name: "posta_frita_kg", label: "Posta Frita (kg)", type: "number", step: "0.001" },
    { name: "posta_chapa_kg", label: "Posta Chapa (kg)", type: "number", step: "0.001" },
    { name: "isca_kg", label: "Isca (kg)", type: "number", step: "0.001" },
    { name: "file_kg", label: "Filé (kg)", type: "number", step: "0.001" },
    {
      name: "total_enviado_kg",
      label: "Total Enviado (kg)",
      type: "number",
      step: "0.001",
      showInTable: true,
      compute: (v) =>
        (Number(v.posta_frita_kg) || 0) +
        (Number(v.posta_chapa_kg) || 0) +
        (Number(v.isca_kg) || 0) +
        (Number(v.file_kg) || 0),
    },
    { name: "custo_frita", label: "Custo Frita (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "custo_chapa", label: "Custo Chapa (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "custo_isca", label: "Custo Isca (R$)", type: "number", step: "0.01", isCurrency: true },
    { name: "custo_file", label: "Custo Filé (R$)", type: "number", step: "0.01", isCurrency: true },
    {
      name: "custo_final",
      label: "Custo Final (R$)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) =>
        (Number(v.custo_frita) || 0) +
        (Number(v.custo_chapa) || 0) +
        (Number(v.custo_isca) || 0) +
        (Number(v.custo_file) || 0),
    },
    { name: "enviou_rateio", label: "Rateio Enviado?", type: "boolean", showInTable: true },
  ],
};

// =====================  REEMBOLSOS  =====================
export const reembolsosConfig: PcpCrudConfig = {
  table: "pcp_reembolsos",
  title: "Reembolsos entre Unidades",
  description: "Pedidos de reembolso entre unidades operacionais",
  orderBy: { column: "data_ref", ascending: false },
  fields: [
    { name: "data_ref", label: "Data Referência", type: "date", required: true, showInTable: true },
    { name: "data_solicitacao", label: "Data Solicitação", type: "date" },
    {
      name: "unidade_origem",
      label: "Unidade Origem",
      type: "select",
      options: unidadeOptions,
      required: true,
      showInTable: true,
    },
    {
      name: "unidade_devedora",
      label: "Unidade Devedora",
      type: "select",
      options: unidadeOptions,
      required: true,
      showInTable: true,
    },
    { name: "descritivo", label: "Descritivo", type: "textarea", required: true, showInTable: true },
    { name: "quantidade", label: "Quantidade", type: "text" },
    { name: "custo_final", label: "Custo Final (R$)", type: "number", step: "0.01", isCurrency: true, showInTable: true },
    { name: "enviou_rateio", label: "Rateio Enviado?", type: "boolean", showInTable: true },
  ],
};

// =====================  VALIDADES  =====================
export const validadesConfig: PcpCrudConfig = {
  table: "pcp_validades",
  title: "Controle de Validades",
  description: "Rastreabilidade por lote e alerta de validade próxima",
  orderBy: { column: "data_validade", ascending: true },
  fields: [
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    { name: "lote", label: "Lote", type: "text", showInTable: true },
    { name: "unidade", label: "Unidade", type: "select", options: unidadeOptions, required: true, showInTable: true },
    { name: "data_producao", label: "Data Produção", type: "date" },
    { name: "data_validade", label: "Data Validade", type: "date", required: true, showInTable: true },
    { name: "quantidade_kg", label: "Quantidade (kg)", type: "number", step: "0.001", showInTable: true },
    { name: "status", label: "Status", type: "select", options: STATUS_VALIDADE, required: true, showInTable: true },
  ],
};

// =====================  PRODUÇÃO  =====================
export const producaoConfig: PcpCrudConfig = {
  table: "pcp_producao",
  title: "Produção Diária",
  description: "Lançamentos de produção, vendas, descarte e cálculo de CMV",
  orderBy: { column: "data", ascending: false },
  fields: [
    { name: "data", label: "Data", type: "date", required: true, showInTable: true },
    { name: "produto", label: "Produto", type: "text", required: true, showInTable: true },
    { name: "unidade", label: "Unidade", type: "select", options: unidadeOptions, required: true, showInTable: true },
    {
      name: "quantidade_produzida_kg",
      label: "Produzida (kg)",
      type: "number",
      step: "0.001",
      showInTable: true,
    },
    {
      name: "quantidade_vendida_kg",
      label: "Vendida (kg)",
      type: "number",
      step: "0.001",
      showInTable: true,
    },
    {
      name: "quantidade_descartada_kg",
      label: "Descartada (kg)",
      type: "number",
      step: "0.001",
    },
    {
      name: "pct_perda",
      label: "% Perda",
      type: "number",
      step: "0.01",
      showInTable: true,
      compute: (v) =>
        v.quantidade_produzida_kg && v.quantidade_descartada_kg
          ? (Number(v.quantidade_descartada_kg) / Number(v.quantidade_produzida_kg)) * 100
          : null,
    },
    { name: "cmv_unitario", label: "CMV Unitário (R$/kg)", type: "number", step: "0.01", isCurrency: true },
    {
      name: "cmv_total",
      label: "CMV Total (R$)",
      type: "number",
      step: "0.01",
      isCurrency: true,
      showInTable: true,
      compute: (v) =>
        v.cmv_unitario && v.quantidade_produzida_kg
          ? Number(v.cmv_unitario) * Number(v.quantidade_produzida_kg)
          : null,
    },
    { name: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export const PCP_TABS: Array<{ key: string; label: string; config: PcpCrudConfig }> = [
  { key: "compras", label: "Compras", config: comprasConfig },
  { key: "rendimento", label: "Rendimento", config: rendimentoConfig },
  { key: "estoque", label: "Estoque CDP", config: estoqueConfig },
  { key: "distribuicao", label: "Distribuição", config: distribuicaoConfig },
  { key: "rateio", label: "Rateio", config: rateioConfig },
  { key: "reembolsos", label: "Reembolsos", config: reembolsosConfig },
  { key: "validades", label: "Validades", config: validadesConfig },
  { key: "producao", label: "Produção", config: producaoConfig },
];
