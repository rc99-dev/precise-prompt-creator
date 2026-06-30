export const UNIDADES = ['CASARÃO', 'VEIGA CABRAL', 'PORTO FUTURO', 'ÓBIDOS', 'ANGUSTURA', 'AQUÁRIOS'] as const;
export const SETORES = ['LOJA', 'BAR', 'SALÃO', 'COZINHA', 'SUPRIMENTOS', 'PRODUÇÃO', 'DIRETORIA', 'GENTE & GESTÃO', 'FINANCEIRO', 'MARKETING', 'PROCESSOS & CONTROLADORIA'] as const;

export type Unidade = typeof UNIDADES[number];
export type Setor = typeof SETORES[number];

export const TITULOS_SOLICITACAO = [
  'Pedido de Açaí', 'Pedido de Aves', 'Pedido de Bebidas Alcoólicas', 'Pedido de Bebidas Não Alcoólicas',
  'Pedido de Cervejas e Chopp', 'Pedido de Congelados', 'Pedido de Descartáveis e Embalagens',
  'Pedido de Equipamentos', 'Pedido de EPIs', 'Pedido de Estoque Seco', 'Pedido de Farinhas',
  'Pedido de Frutos do Mar', 'Pedido de Gás', 'Pedido de Gelo', 'Pedido de Hortfruit',
  'Pedido de Mat. Escritório', 'Pedido de Mat. Higiene e Limpeza', 'Pedido de Peixe',
  'Pedido de Polpas', 'Pedido de Processados', 'Pedido de Proteína', 'Pedido de Utensílios',
  'Pedido de Artesanato', 'Pedido de Sobremesa', 'Pedido de Sorvete', 'Pedido de Vinhos',
] as const;

// Títulos usados especificamente para inventários — mesmo mapeamento de categoria dos pedidos.
export const TITULOS_INVENTARIO = [
  'Inventário de Açaí', 'Inventário de Aves', 'Inventário de Bebidas Alcoólicas', 'Inventário de Bebidas Não Alcoólicas',
  'Inventário de Cervejas e Chopp', 'Inventário de Congelados', 'Inventário de Descartáveis e Embalagens',
  'Inventário de Equipamentos', 'Inventário de EPIs', 'Inventário de Estoque Seco', 'Inventário de Farinhas',
  'Inventário de Frutos do Mar', 'Inventário de Gás', 'Inventário de Gelo', 'Inventário de Hortfruit',
  'Inventário de Mat. Escritório', 'Inventário de Mat. Higiene e Limpeza', 'Inventário de Peixe',
  'Inventário de Polpas', 'Inventário de Processados', 'Inventário de Proteína', 'Inventário de Utensílios',
  'Inventário de Artesanato', 'Inventário de Sobremesa', 'Inventário de Sorvete', 'Inventário de Vinhos',
] as const;

// Maps a título de solicitação para a categoria correspondente em products.categoria
// (categorias armazenadas em maiúsculo). Apenas pré-seleciona a categoria.
export const TITULO_TO_CATEGORIA: Record<string, string> = {
  'Pedido de Açaí': 'AÇAÍ',
  'Pedido de Aves': 'AVES',
  'Pedido de Bebidas Alcoólicas': 'BEBIDAS ALCOÓLICAS',
  'Pedido de Bebidas Não Alcoólicas': 'BEBIDAS NÃO ALCOÓLICAS',
  'Pedido de Cervejas e Chopp': 'CERVEJAS E CHOPP',
  'Pedido de Congelados': 'CONGELADOS',
  'Pedido de Descartáveis e Embalagens': 'DESCARTÁVEIS E EMBALAGENS',
  'Pedido de Equipamentos': 'EQUIPAMENTOS',
  'Pedido de EPIs': 'EPIs',
  'Pedido de Estoque Seco': 'ESTOQUE SECO',
  'Pedido de Farinhas': 'FARINHAS',
  'Pedido de Frutos do Mar': 'FRUTOS DO MAR',
  'Pedido de Gás': 'GÁS',
  'Pedido de Gelo': 'GELO',
  'Pedido de Hortfruit': 'HORTFRUIT',
  'Pedido de Mat. Escritório': 'MAT. ESCRITÓRIO',
  'Pedido de Mat. Higiene e Limpeza': 'MAT. HIGIENE E LIMPEZA',
  'Pedido de Peixe': 'PEIXE',
  'Pedido de Polpas': 'POLPAS',
  'Pedido de Processados': 'PROCESSADOS',
  'Pedido de Proteína': 'PROTEÍNA',
  'Pedido de Utensílios': 'UTENSÍLIOS',
  'Pedido de Artesanato': 'ARTESANATO',
  'Pedido de Sobremesa': 'SOBREMESA',
  'Pedido de Sorvete': 'SORVETE',
  'Pedido de Vinhos': 'VINHOS',
};

// Maps a título de inventário para a categoria correspondente em products.categoria.
export const TITULO_INVENTARIO_TO_CATEGORIA: Record<string, string> = {
  'Inventário de Açaí': 'AÇAÍ',
  'Inventário de Aves': 'AVES',
  'Inventário de Bebidas Alcoólicas': 'BEBIDAS ALCOÓLICAS',
  'Inventário de Bebidas Não Alcoólicas': 'BEBIDAS NÃO ALCOÓLICAS',
  'Inventário de Cervejas e Chopp': 'CERVEJAS E CHOPP',
  'Inventário de Congelados': 'CONGELADOS',
  'Inventário de Descartáveis e Embalagens': 'DESCARTÁVEIS E EMBALAGENS',
  'Inventário de Equipamentos': 'EQUIPAMENTOS',
  'Inventário de EPIs': 'EPIs',
  'Inventário de Estoque Seco': 'ESTOQUE SECO',
  'Inventário de Farinhas': 'FARINHAS',
  'Inventário de Frutos do Mar': 'FRUTOS DO MAR',
  'Inventário de Gás': 'GÁS',
  'Inventário de Gelo': 'GELO',
  'Inventário de Hortfruit': 'HORTFRUIT',
  'Inventário de Mat. Escritório': 'MAT. ESCRITÓRIO',
  'Inventário de Mat. Higiene e Limpeza': 'MAT. HIGIENE E LIMPEZA',
  'Inventário de Peixe': 'PEIXE',
  'Inventário de Polpas': 'POLPAS',
  'Inventário de Processados': 'PROCESSADOS',
  'Inventário de Proteína': 'PROTEÍNA',
  'Inventário de Utensílios': 'UTENSÍLIOS',
  'Inventário de Artesanato': 'ARTESANATO',
  'Inventário de Sobremesa': 'SOBREMESA',
  'Inventário de Sorvete': 'SORVETE',
  'Inventário de Vinhos': 'VINHOS',
};
