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
