import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'solicitante' | 'comprador' | 'aprovador' | 'estoquista' | 'master';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export async function getUserRole(userId: string): Promise<AppRole> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  return (data?.role as AppRole) || 'solicitante';
}

export const roleLabels: Record<AppRole, string> = {
  solicitante: 'Solicitante',
  comprador: 'Comprador',
  aprovador: 'Aprovador',
  estoquista: 'Estoquista',
  master: 'Master',
};

export const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  emitido: 'Emitido',
  recebido: 'Recebido',
  recebido_com_ocorrencia: 'Recebido c/ Ocorrência',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
  incluida_no_pedido: 'Incluída no Pedido',
  recusada: 'Recusada',
};

export const statusColors: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  aguardando_aprovacao: 'bg-warning/20 text-warning',
  aprovado: 'bg-success/20 text-success',
  rejeitado: 'bg-destructive/20 text-destructive',
  emitido: 'bg-info/20 text-info',
  recebido: 'bg-success/20 text-success',
  recebido_com_ocorrencia: 'bg-warning/20 text-warning',
  cancelado: 'bg-muted text-muted-foreground',
  pendente: 'bg-warning/20 text-warning',
};

export function canAccess(role: AppRole | null, page: string): boolean {
  if (!role) return false;
  if (role === 'master') return true;

  const permissions: Record<string, AppRole[]> = {
    dashboard: ['comprador', 'aprovador', 'estoquista', 'master'],
    solicitacoes: ['solicitante', 'comprador', 'master'],
    'minhas-solicitacoes': ['solicitante'],
    'nova-ordem': ['comprador', 'master'],
    historico: ['comprador', 'aprovador', 'estoquista', 'master'],
    comparativo: ['comprador', 'master'],
    aprovacoes: ['aprovador', 'master'],
    recebimentos: ['estoquista', 'master'],
    fornecedores: ['comprador', 'aprovador', 'master'],
    produtos: ['comprador', 'aprovador', 'master'],
    precos: ['comprador', 'aprovador', 'master'],
    usuarios: ['master'],
    relatorios: ['master'],
  };

  return permissions[page]?.includes(role) || false;
}
