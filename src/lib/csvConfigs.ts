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
    { csvHeader: "razao_social", dbField: "razao_social", required: true, label: "Razão Social" },
    { csvHeader: "cnpj", dbField: "cnpj", required: true, label: "CNPJ",
      validate: validateCnpj,
      transform: (v) => v.replace(/\D/g, '') || null },
    { csvHeader: "telefone", dbField: "telefone", required: false, label: "Telefone" },
    { csvHeader: "email", dbField: "email", required: false, label: "E-mail" },
    { csvHeader: "cidade", dbField: "cidade", required: false, label: "Cidade" },
    { csvHeader: "estado", dbField: "estado", required: false, label: "Estado" },
    { csvHeader: "nome_fantasia", dbField: "nome_fantasia", required: false, label: "Nome Fantasia" },
    { csvHeader: "contato_principal", dbField: "contato_principal", required: false, label: "Contato" },
  ],
  onImport: async (rows) => {
    let created = 0, updated = 0, ignored = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const cnpj = row.cnpj as string;
      const payload: any = { ...row, status: 'ativo' };
      const { data: existing } = await supabase.from('suppliers').select('id').eq('cnpj', cnpj).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', existing.id);
        if (error) { errors.push(`CNPJ ${cnpj}: ${error.message}`); ignored++; } else updated++;
      } else {
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) { errors.push(`CNPJ ${cnpj}: ${error.message}`); ignored++; } else created++;
      }
    }
    return { success: created + updated, errors: [...errors, `Resumo: ${created} criados, ${updated} atualizados, ${ignored} ignorados`] };
  },
};

export const productsImportConfig: CsvImportConfig = {
  title: "Importar Produtos (CSV)",
  templateFilename: "modelo_produtos.csv",
  columns: [
    { csvHeader: "nome", dbField: "nome", required: true, label: "Nome" },
    { csvHeader: "categoria", dbField: "categoria", required: true, label: "Categoria" },
    { csvHeader: "unidade_medida", dbField: "unidade_medida", required: true, label: "Unidade",
      validate: (v) => VALID_UNITS.includes(v.toLowerCase()) ? null : `Unidade não reconhecida: "${v}"`,
      transform: (v) => v.toLowerCase() },
    { csvHeader: "codigo_interno", dbField: "codigo_interno", required: false, label: "Código Interno" },
    { csvHeader: "marca", dbField: "marca", required: false, label: "Marca" },
    { csvHeader: "descricao", dbField: "descricao", required: false, label: "Descrição" },
  ],
  onImport: async (rows) => {
    let created = 0, updated = 0, ignored = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const nome = row.nome as string;
      const codigo = row.codigo_interno as string | null;
      const payload: any = { ...row, status: 'ativo' };
      // upsert primeiro por código_interno; senão por nome
      let existing: any = null;
      if (codigo) {
        ({ data: existing } = await supabase.from('products').select('id').eq('codigo_interno', codigo).maybeSingle());
      }
      if (!existing) {
        ({ data: existing } = await supabase.from('products').select('id').eq('nome', nome).maybeSingle());
      }
      if (existing) {
        const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
        if (error) { errors.push(`"${nome}": ${error.message}`); ignored++; } else updated++;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) { errors.push(`"${nome}": ${error.message}`); ignored++; } else created++;
      }
    }
    return { success: created + updated, errors: [...errors, `Resumo: ${created} criados, ${updated} atualizados, ${ignored} ignorados`] };
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
      { csvHeader: "produto_nome", dbField: "product_id", required: true, label: "Produto",
        validate: (v) => productsMap.has(v.toLowerCase()) ? null : `Produto não encontrado: "${v}"`,
        transform: (v) => productsMap.get(v.toLowerCase()) || null },
      { csvHeader: "fornecedor_razao_social", dbField: "supplier_id", required: true, label: "Fornecedor",
        validate: (v) => suppliersMap.has(v.toLowerCase()) ? null : `Fornecedor não encontrado: "${v}"`,
        transform: (v) => suppliersMap.get(v.toLowerCase()) || null },
      { csvHeader: "preco_unitario", dbField: "preco_unitario", required: true, label: "Preço Unitário",
        validate: (v) => {
          const n = parseFloat(v.replace(',', '.'));
          return isNaN(n) || n <= 0 ? `Preço inválido: "${v}"` : null;
        },
        transform: (v) => parseFloat(v.replace(',', '.')) },
      { csvHeader: "unidade_medida", dbField: "unidade_medida", required: false, label: "Unidade" },
      { csvHeader: "prazo_entrega", dbField: "prazo_entrega", required: false, label: "Prazo Entrega" },
    ],
    onImport: async (rows) => {
      let created = 0, updated = 0, ignored = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const { data: existing } = await supabase.from('supplier_prices')
          .select('id')
          .eq('product_id', row.product_id as string)
          .eq('supplier_id', row.supplier_id as string)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase.from('supplier_prices').update(row as any).eq('id', existing.id);
          if (error) { errors.push(`Preço: ${error.message}`); ignored++; } else updated++;
        } else {
          const { error } = await supabase.from('supplier_prices').insert(row as any);
          if (error) { errors.push(`Preço: ${error.message}`); ignored++; } else created++;
        }
      }
      return { success: created + updated, errors: [...errors, `Resumo: ${created} criados, ${updated} atualizados, ${ignored} ignorados`] };
    },
  };
}
