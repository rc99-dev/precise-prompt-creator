import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Copy, Download, FileText, Pencil, Trash2, Calendar, ChevronDown } from "lucide-react";
import { formatCurrency, formatDate, statusColors } from "@/lib/helpers";
import { generateOrderPDF, generateOrderPDFBySupplier } from "@/lib/pdfGenerator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrderDetailDialog from "@/components/order/OrderDetailDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; observacoes: string | null; total: number;
  created_at: string; profiles?: { full_name: string } | null;
  comprador_nome?: string;
};

type OrderItem = {
  id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  observacoes: string | null;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

const fetchOrders = async () => {
  const [{ data: orders, error }, { data: profiles }] = await Promise.all([
    supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('user_id, full_name'),
  ]);
  if (error) throw error;
  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
  return (orders || []).map((o: any) => ({ ...o, comprador_nome: profileMap[o.user_id] || '—' })) as unknown as Order[];
};

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previsaoTarget, setPrevisaoTarget] = useState<Order | null>(null);
  const [previsaoData, setPrevisaoData] = useState("");
  const [previsaoObs, setPrevisaoObs] = useState("");
  const [savingPrevisao, setSavingPrevisao] = useState(false);

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['order-history'],
    queryFn: fetchOrders,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'todos' || o.status === statusFilter;
    const matchSearch = o.numero.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const viewOrder = async (order: Order) => {
    setSelectedOrder(order);
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, products(nome, unidade_medida), suppliers(razao_social)')
      .eq('order_id', order.id);
    setOrderItems((data || []) as unknown as OrderItem[]);
    setDialogOpen(true);
  };

  const duplicateOrder = async (order: Order) => {
    const { data: numData } = await supabase.rpc('generate_order_number');
    const numero = numData || `OC-${Date.now()}`;
    const { data: newOrder, error } = await supabase.from('purchase_orders').insert({
      numero, user_id: user!.id, modo: order.modo, status: 'rascunho',
      observacoes: order.observacoes, total: order.total,
    }).select().single();
    if (error || !newOrder) { toast.error("Erro ao duplicar."); return; }
    const { data: items } = await supabase.from('purchase_order_items').select('*').eq('order_id', order.id);
    if (items) {
      const newItems = items.map(i => ({
        order_id: newOrder.id, product_id: i.product_id, supplier_id: i.supplier_id,
        quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal, observacoes: i.observacoes,
      }));
      await supabase.from('purchase_order_items').insert(newItems);
    }
    toast.success("Ordem duplicada como rascunho!");
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('purchase_order_items').delete().eq('order_id', deleteTarget.id);
    const { error } = await supabase.from('purchase_orders').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); } else { toast.success("Pedido excluído!"); }
    setDeleting(false);
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
  };

  const exportCSV = async (order: Order) => {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*, products(nome, unidade_medida, codigo_interno), suppliers(razao_social)')
      .eq('order_id', order.id) as { data: OrderItem[] | null };
    if (!items) return;
    const header = "Produto;Unidade;Quantidade;Fornecedor;Preço Unitário;Subtotal\n";
    const rows = items.map(i =>
      `${i.products?.nome};${i.products?.unidade_medida};${i.quantidade};${i.suppliers?.razao_social || ''};${i.preco_unitario};${i.subtotal}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${order.numero}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const exportPDF = async (order: Order) => {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*, products(nome, unidade_medida, codigo_interno), suppliers(razao_social, cnpj, telefone, cidade)')
      .eq('order_id', order.id);
    if (!items || items.length === 0) { toast.error("Sem itens para exportar."); return; }
    const { data: buyerProfile } = await supabase.from('profiles').select('full_name').eq('user_id', order.user_id).single();
    let aprovadorName: string | null = null;
    if (order.status === 'aprovado' || order.status === 'emitido' || order.status === 'recebido') {
      const { data: log } = await supabase.from('approval_log').select('user_id').eq('order_id', order.id).eq('action', 'aprovado').limit(1).single();
      if (log) {
        const { data: ap } = await supabase.from('profiles').select('full_name').eq('user_id', log.user_id).single();
        aprovadorName = ap?.full_name || null;
      }
    }
    const mainSupplier = items[0]?.suppliers as any;
    generateOrderPDF({
      numero: order.numero, created_at: order.created_at, observacoes: order.observacoes,
      total: order.total, unidadeSolicitante: (order as any).unidade_setor || undefined,
      supplier: mainSupplier ? { razao_social: mainSupplier.razao_social, cnpj: mainSupplier.cnpj, telefone: mainSupplier.telefone, cidade: mainSupplier.cidade } : null,
      items: items.map(i => ({
        codigo: (i.products as any)?.codigo_interno, descricao: (i.products as any)?.nome || "",
        unidade: (i.products as any)?.unidade_medida || "", quantidade: i.quantidade,
        preco_unitario: i.preco_unitario, subtotal: i.subtotal,
      })),
      comprador: buyerProfile?.full_name, aprovador: aprovadorName, approved_at: (order as any).approved_at,
    });

    // Atualiza status para emitido se estava aprovado
    if (order.status === 'aprovado') {
      await supabase.from('purchase_orders').update({ status: 'emitido' }).eq('id', order.id);
      const { data: estoquistas } = await supabase.from('user_roles').select('user_id').eq('role', 'estoquista');
      if (estoquistas?.length) {
        await supabase.from('notifications').insert(estoquistas.map(e => ({
          user_id: e.user_id,
          titulo: 'Nova ordem emitida',
          mensagem: `Pedido ${order.numero} foi emitido — aguardando confirmação do fornecedor.`,
          tipo: 'info', lida: false,
        })));
      }
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
    }
    toast.success("PDF gerado!");
  };

  const handleSalvarPrevisao = async () => {
    if (!previsaoTarget || !previsaoData) { toast.error("Informe a data prevista."); return; }
    setSavingPrevisao(true);
    await supabase.from('purchase_orders').update({
      previsao_entrega: previsaoData,
      obs_estoquista: previsaoObs || null,
      previsao_registrada_por: user?.id || null,
    } as any).eq('id', previsaoTarget.id);
    const { data: estoquistas } = await supabase.from('user_roles').select('user_id').eq('role', 'estoquista');
    if (estoquistas?.length) {
      await supabase.from('notifications').insert(estoquistas.map(e => ({
        user_id: e.user_id,
        titulo: 'Previsão de entrega registrada',
        mensagem: `Pedido ${previsaoTarget.numero} — Entrega prevista para ${new Date(previsaoData).toLocaleDateString('pt-BR')}. ${previsaoObs || ''}`,
        tipo: 'info', lida: false,
      })));
    }
    toast.success("Previsão registrada! Estoquista notificado.");
    setSavingPrevisao(false);
    setPrevisaoTarget(null);
    setPrevisaoData("");
    setPrevisaoObs("");
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      rascunho: 'Rascunho', aguardando_aprovacao: 'Aguardando Aprovação',
      aprovado: 'Aprovado', rejeitado: 'Rejeitado', emitido: 'Emitido',
      recebido: 'Recebido', recebido_com_ocorrencia: 'Recebido c/ Ocorrência', cancelado: 'Cancelado',
    };
    return map[s] || s;
  };

  const statusBadgeClass = (s: string): string => {
    return statusColors[s] || 'bg-muted text-muted-foreground';
  };

  const modoLabel = (m: string) => m === 'manual' ? 'Manual' : m === 'melhor_preco' ? 'Melhor Preço' : 'Melhor Fornecedor';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Ordens</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulte e gerencie suas ordens de compra</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
            <SelectItem value="emitido">Emitido</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Modo</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Comprador</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma ordem encontrada.</td></tr>
                  ) : filtered.map(o => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{o.numero}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(o.created_at)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{modoLabel(o.modo)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{o.comprador_nome || '—'}</td>
                      <td className="py-3 px-4 text-right currency font-medium">{formatCurrency(o.total)}</td>
                      <td className="py-3 px-4 text-center"><Badge className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</Badge></td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" onClick={() => viewOrder(o)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => exportPDF(o)} title="PDF"><FileText className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => duplicateOrder(o)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => exportCSV(o)} title="CSV"><Download className="h-4 w-4" /></Button>
                          {o.status === 'emitido' && (
                            <Button variant="ghost" size="icon" onClick={() => { setPrevisaoTarget(o); setPrevisaoData(""); setPrevisaoObs(""); }} title="Registrar previsão de entrega">
                              <Calendar className="h-4 w-4 text-amber-400" />
                            </Button>
                          )}
                          {o.status === 'rascunho' && (
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/nova-ordem?edit=${o.id}`)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {(o.status === 'rascunho' || o.status === 'rejeitado') && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(o)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        orderItems={orderItems}
        statusLabel={statusLabel}
        statusBadgeClass={statusBadgeClass}
        modoLabel={modoLabel}
      />

      <Dialog open={!!previsaoTarget} onOpenChange={(open) => !open && setPrevisaoTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar previsão de entrega</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Pedido: <span className="font-medium text-foreground">{previsaoTarget?.numero}</span></div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data prevista de entrega *</label>
              <Input type="date" value={previsaoData} onChange={e => setPrevisaoData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação para o estoquista</label>
              <Input placeholder="Ex: Entregar na portaria das 8h às 10h" value={previsaoObs} onChange={e => setPrevisaoObs(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPrevisaoTarget(null)}>Cancelar</Button>
              <Button onClick={handleSalvarPrevisao} disabled={savingPrevisao}>
                {savingPrevisao ? "Salvando..." : "Confirmar e notificar estoquista"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o pedido <strong>{deleteTarget?.numero}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
