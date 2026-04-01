export const UNIDADES = ['CASARÃO', 'VEIGA CABRAL', 'PORTO FUTURO'] as const;
export const SETORES = ['COZINHA', 'SALÃO/ATENDIMENTO', 'BAR', 'CENTRAL'] as const;
export const UNIDADES_USUARIO = ['CASARÃO', 'VEIGA CABRAL', 'PORTO FUTURO', 'ADM'] as const;

export type Unidade = typeof UNIDADES[number];
export type Setor = typeof SETORES[number];
