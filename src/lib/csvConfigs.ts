import { supabase } from "@/integrations/supabase/client";
import type { CsvImportConfig } from "@/components/CsvImportModal";

function validateCnpj(v: string): string | null {
  const digits = v.replace(/\D/g, '');
  if (digits.length !== 14 && digits.length !== 11) return `CNPJ/CPF inválido: "${v}"`;
  return null;
}

const VALID_UNITS = ["kg", "g", "litro", "ml", "unidade", "caixa", "pacote", "saco", "dúzia", "metro"];

export const suppliersImportConfig: CsvImportConfig = {
  title: "Importar Fornecedores (CSV)",
  templateFilename: "modelo_fornecedores.csv",
  columns: [
    { csvHeader: "nome", dbField: "razao_social", required: true, label: "Nome / Razão Social" },
    { csvHeader: "cnpj", dbField: "cnpj", required: true, label: "CNPJ",
      validate: validateCnpj,
      transform: (v) => v.replace(/\D/g, '') || null },
    { csvHeader: "status", dbField: "status", required: true, label: "Status",
      validate: (v) => ['ativo', 'inativo'].includes(v.toLowerCase()) ? null : `Status inválido: "${v}" (use ativo/inativo)`,
      transform: (v) => v.toLowerCase() },
    { csvHeader: "nome_fantasia", dbField: "nome_fantasia", required: false, label: "Nome Fantasia" },
    { csvHeader: "telefone", dbField: "telefone", required: false, label: "Telefone" },
    { csvHeader: "email", dbField: "email", required: false, label: "E-mail" },
    { csvHeader: "cidade", dbField: "cidade", required: false, label: "Cidade" },
    { csvHeader: "contato_principal", dbField: "contato_principal", required: false, label: "Contato" },
  ],
  onImport: async (rows) => {
    let success = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const cnpj = row.cnpj as string;
      // Upsert: check if exists by cnpj
      const { data: existing } = await supabase.from('suppliers').select('id').eq('cnpj', cnpj).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('suppliers').update(row as any).eq('id', existing.id);
        if (error) errors.push(`Linha CNPJ ${cnpj}: ${error.message}`);
        else success++;
      } else {
        const { error } = await supabase.from('suppliers').insert(row as any);
        if (error) errors.push(`Linha CNPJ ${cnpj}: ${error.message}`);
        else success++;
      }
    }
    return { success, errors };
  },
};

export const productsImportConfig: CsvImportConfig = {
  title: "Importar Produtos (CSV)",
  templateFilename: "modelo_produtos.csv",
  columns: [
    { csvHeader: "nome", dbField: "nome", required: true, label: "Nome" },
    { csvHeader: "unidade", dbField: "unidade_medida", required: true, label: "Unidade",
      validate: (v) => VALID_UNITS.includes(v.toLowerCase()) ? null : `Unidade não reconhecida: "${v}"`,
      transform: (v) => v.toLowerCase() },
    { csvHeader: "categoria", dbField: "categoria", required: true, label: "Categoria" },
    { csvHeader: "codigo_interno", dbField: "codigo_interno", required: false, label: "Código Interno" },
    { csvHeader: "marca", dbField: "marca", required: false, label: "Marca" },
    { csvHeader: "status", dbField: "status", required: false, label: "Status",
      validate: (v) => !v || ['ativo', 'inativo'].includes(v.toLowerCase()) ? null : `Status inválido: "${v}"`,
      transform: (v) => v?.toLowerCase() || 'ativo' },
    { csvHeader: "descricao", dbField: "descricao", required: false, label: "Descrição" },
  ],
  onImport: async (rows) => {
    let success = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const nome = row.nome as string;
      const { data: existing } = await supabase.from('products').select('id').eq('nome', nome).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('products').update(row as any).eq('id', existing.id);
        if (error) errors.push(`"${nome}": ${error.message}`);
        else success++;
      } else {
        const { error } = await supabase.from('products').insert(row as any);
        if (error) errors.push(`"${nome}": ${error.message}`);
        else success++;
      }
    }
    return { success, errors };
  },
};

export function createPricesImportConfig(
  productsMap: Map<string, string>,
  suppliersMap: Map<string, string>
): CsvImportConfig {
  return {
    title: "Importar Preços (CSV)",
    templateFilename: "modelo_precos.csv",
    columns: [
      { csvHeader: "produto", dbField: "product_id", required: true, label: "Produto",
        validate: (v) => productsMap.has(v.toLowerCase()) ? null : `Produto não encontrado: "${v}"`,
        transform: (v) => productsMap.get(v.toLowerCase()) || null },
      { csvHeader: "fornecedor", dbField: "supplier_id", required: true, label: "Fornecedor",
        validate: (v) => suppliersMap.has(v.toLowerCase()) ? null : `Fornecedor não encontrado: "${v}"`,
        transform: (v) => suppliersMap.get(v.toLowerCase()) || null },
      { csvHeader: "preco_unitario", dbField: "preco_unitario", required: true, label: "Preço Unitário",
        validate: (v) => {
          const n = parseFloat(v.replace(',', '.'));
          return isNaN(n) || n <= 0 ? `Preço não é um número válido: "${v}"` : null;
        },
        transform: (v) => parseFloat(v.replace(',', '.')) },
      { csvHeader: "prazo_entrega", dbField: "prazo_entrega", required: false, label: "Prazo Entrega" },
      { csvHeader: "quantidade_minima", dbField: "quantidade_minima", required: false, label: "Qtd Mínima",
        transform: (v) => v ? parseFloat(v.replace(',', '.')) || null : null },
    ],
    onImport: async (rows) => {
      let success = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const { data: existing } = await supabase.from('supplier_prices')
          .select('id')
          .eq('product_id', row.product_id as string)
          .eq('supplier_id', row.supplier_id as string)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase.from('supplier_prices').update(row as any).eq('id', existing.id);
          if (error) errors.push(`Preço: ${error.message}`);
          else success++;
        } else {
          const { error } = await supabase.from('supplier_prices').insert(row as any);
          if (error) errors.push(`Preço: ${error.message}`);
          else success++;
        }
      }
      return { success, errors };
    },
  };
}
