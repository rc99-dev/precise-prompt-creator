import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UNIDADES } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Package, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type ReceiptOrder = {
  id: string; numero: string; status: string; total: number;
  created_at: string; user_id: string; previsao_entrega: string | null;
  obs_estoquista: string | null; observacoes: string | null;
  comprador_nome?: string; unidade_comprador?: string;
};

type OrderItemForReceipt = {
  id: string; product_id: string; quantidade: number; preco_unitario: number;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

type ReceiptItemForm = {
  order_item_id: string; status: string; quantidade_recebida: string;
  tipo_ocorrencia: string; observacoes: string;
};

const fetchReceiptOrders = async () => {
  const [{ data: orders, error }, { data: profiles }] = await Promise.all([
    supabase.from('purchase_orders').select('*')
      .in('status', ['emitido', 'recebido', 'recebido_com_ocorrencia'])
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('user_id, full_name, unidade'),
  ]);
  if (error) throw error;
  const profileMap: Record<string, { name: string; unidade: string }> = {};
  (profiles || []).forEach((p: any) => {
    profileMap[p.user_id] = { name: p.full_name, unidade: p.unidade || '' };
  });
  const mapped = (orders || []).map((o: any) => ({
    ...o,
    comprador_nome: profileMap[o.user_id]?.name || '—',
    unidade_comprador: profileMap[o.user_id]?.unidade || '',
  })) as ReceiptOrder[];
  return sortOrders(mapped);
};

function sortOrders(mapped: ReceiptOrder[]) {
  return mapped.sort((a, b) => {
    if (a.status === 'emitido' && b.status !== 'emitido') return -1;
    if (a.status !== 'emitido' && b.status === 'emitido') return 1;
    if (a.status === 'emitido' && b.status === 'emitido') {
      if (!a.previsao_entrega) return 1;
      if (!b.previsao_entrega) return -1;
      return a.previsao_entrega.localeCompare(b.previsao_entrega);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getDeliveryBadge(previsao: string | null) {
  if (!previsao) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const delivery = new Date(previsao + 'T00:00:00'); delivery.setHours(0, 0, 0, 0);
  const diff = delivery.getTime() - today.getTime();
  if (diff < 0) return <Badge className="bg-destructive/20 text-destructive text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>;
  if (diff === 0) return <Badge className="bg-warning/20 text-warning text-[10px]"><Clock className="h-3 w-3 mr-1" />Hoje</Badge>;
  return null;
}

const OCORRENCIA_TIPOS = [
  { value: 'avaria', label: 'Avaria' },
  { value: 'divergencia_quantidade', label: 'Qtd Errada' },
  { value: 'produto_errado', label: 'Produto Errado' },
  { value: 'nf_incorreta', label: 'NF Incorreta' },
];

export default function ReceiptsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemForReceipt[]>([]);
  const [receiptItems, setReceiptItems] = useState<ReceiptItemForm[]>([]);
  const [numeroNF, setNumeroNF] = useState("");
  const [obsGeral, setObsGeral] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterUnidade, setFilterUnidade] = useState("todas");

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['receipt-orders'],
    queryFn: fetchReceiptOrders,
    staleTime: 2 * 60 * 1000,
  });

  const filteredOrders = filterUnidade === 'todas' ? orders : orders.filter(o => o.unidade_comprador === filterUnidade);
  const pendingOrders = filteredOrders.filter(o => o.status === 'emitido' && o.previsao_entrega);
  const receivedOrders = filteredOrders.filter(o => o.status === 'recebido' || o.status === 'recebido_com_ocorrencia');

  const openReceipt = async (order: ReceiptOrder) => {
    setSelectedOrder(order);
    setNumeroNF("");
    setObsGeral("");
    const { data } = await supabase.from('purchase_order_items')
      .select('*, products(nome, unidade_medida), suppliers(razao_social)')
      .eq('order_id', order.id);
    const items = (data || []) as unknown as OrderItemForReceipt[];
    setOrderItems(items);
    setReceiptItems(items.map(i => ({
      order_item_id: i.id, status: 'recebido', quantidade_recebida: i.quantidade.toString(),
      tipo_ocorrencia: '', observacoes: '',
    })));
  };

  const updateReceiptItem = (idx: number, updates: Partial<ReceiptItemForm>) => {
    setReceiptItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const handleSave = async () => {
    if (!selectedOrder || !user) return;
    setSaving(true);
    const { data: numData } = await supabase.rpc('generate_receipt_number' as any);
    const numero = (numData as string) || `REC-${Date.now()}`;
    const hasOccurrence = receiptItems.some(i => i.status !== 'recebido');
    const orderStatus = hasOccurrence ? 'recebido_com_ocorrencia' : 'recebido';

    const { data: receipt, error: recError } = await supabase.from('receipts').insert({
      numero, order_id: selectedOrder.id, user_id: user.id,
      numero_nf: numeroNF || null, status: orderStatus, observacoes: obsGeral || null,
    } as any).select().single();
    if (recError) { toast.error(recError.message); setSaving(false); return; }

    const items = receiptItems.map(i => ({
      receipt_id: (receipt as any).id, order_item_id: i.order_item_id, status: i.status,
      quantidade_recebida: parseFloat(i.quantidade_recebida) || 0,
      tipo_ocorrencia: i.tipo_ocorrencia || null, observacoes: i.observacoes || null,
    }));
    await supabase.from('receipt_items').insert(items as any);
    await supabase.from('purchase_orders').update({ status: orderStatus } as any).eq('id', selectedOrder.id);

    // MELHORIA 12 — Notificações de recebimento
    const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
    const estoquistaNome = myProfile?.full_name || 'Assistente de Suprimentos';
    const dataRecebimento = formatDate(new Date().toISOString());

    // Notify order creator
    const notifCreator: any = {
      user_id: selectedOrder.user_id,
      titulo: hasOccurrence ? '⚠️ Recebido com ocorrências' : 'Pedido recebido',
      mensagem: hasOccurrence
        ? `Pedido ${selectedOrder.numero} foi recebido com ocorrências por ${estoquistaNome} em ${dataRecebimento} — verifique os detalhes.`
        : `Pedido ${selectedOrder.numero} foi recebido por ${estoquistaNome} em ${dataRecebimento}.`,
      tipo: hasOccurrence ? 'alerta' : 'info',
      lida: false,
    };
    await supabase.from('notifications').insert(notifCreator);

    // If occurrence, also notify all aprovadores
    if (hasOccurrence) {
      const { data: aprovadores } = await supabase.from('user_roles').select('user_id').eq('role', 'aprovador');
      if (aprovadores?.length) {
        await supabase.from('notifications').insert(aprovadores.map((a: any) => ({
          user_id: a.user_id,
          titulo: '⚠️ Ocorrência no recebimento',
          mensagem: `Pedido ${selectedOrder.numero} recebido com ocorrências — ${estoquistaNome} em ${dataRecebimento}.`,
          tipo: 'alerta', lida: false,
        })));
      }
    }

    toast.success("Recebimento registrado!");
    setSaving(false);
    setSelectedOrder(null);
    queryClient.invalidateQueries({ queryKey: ['receipt-orders'] });
  };

  const renderOrderCard = (o: ReceiptOrder, showReceiveButton: boolean) => (
    <Card key={o.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => showReceiveButton ? openReceipt(o) : null}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{o.numero}</p>
            <p className="text-xs text-muted-foreground">{o.comprador_nome} • {formatDate(o.created_at)}</p>
            {o.previsao_entrega && (
              <p className="text-xs text-muted-foreground">Entrega: {formatDate(o.previsao_entrega)}</p>
            )}
            {o.obs_estoquista && (
              <p className="text-xs text-muted-foreground italic">{o.obs_estoquista}</p>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-lg font-bold currency">{formatCurrency(o.total)}</p>
          {showReceiveButton ? (
            <div className="flex items-center gap-2">
              {getDeliveryBadge(o.previsao_entrega)}
              <Badge className="bg-info/20 text-info">Emitido</Badge>
            </div>
          ) : (
            <Badge className={o.status === 'recebido' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}>
              {o.status === 'recebido' ? 'Recebido' : 'Recebido c/ Ocorrência'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recebimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre o recebimento de pedidos emitidos</p>
        </div>
        <div className="w-52">
          <Select value={filterUnidade} onValueChange={setFilterUnidade}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Filtrar por unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent><TableSkeleton columns={3} rows={4} /></CardContent></Card>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : (
        <Tabs defaultValue="pendentes">
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({pendingOrders.length})</TabsTrigger>
            <TabsTrigger value="recebidos">Recebidos ({receivedOrders.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pendentes">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Truck className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">Nenhum pedido aguardando recebimento</p>
                  <p className="text-xs mt-1">Pedidos emitidos com previsão de entrega aparecerão aqui</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 mt-3">{pendingOrders.map(o => renderOrderCard(o, true))}</div>
            )}
          </TabsContent>
          <TabsContent value="recebidos">
            {receivedOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">Nenhum recebimento registrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 mt-3">{receivedOrders.map(o => renderOrderCard(o, false))}</div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Recebimento — {selectedOrder?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da NF</Label>
                <Input value={numeroNF} onChange={e => setNumeroNF(e.target.value)} placeholder="Nº da nota fiscal" />
              </div>
              <div className="space-y-2">
                <Label>Observações gerais</Label>
                <Input value={obsGeral} onChange={e => setObsGeral(e.target.value)} placeholder="Obs geral do recebimento" />
              </div>
            </div>
            <div className="space-y-3">
              {orderItems.map((item, idx) => (
                <Card key={item.id}>
                  <CardContent className="py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.products?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Esperado: {item.quantidade} {item.products?.unidade_medida} — {item.suppliers?.razao_social}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={receiptItems[idx]?.status} onValueChange={v => updateReceiptItem(idx, { status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recebido">Conforme</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                            <SelectItem value="ocorrencia">Ocorrência</SelectItem>
                            <SelectItem value="nao_recebido">Não recebido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {receiptItems[idx]?.status === 'parcial' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Qtd recebida</Label>
                          <Input type="number" step="0.01" value={receiptItems[idx]?.quantidade_recebida}
                            onChange={e => updateReceiptItem(idx, { quantidade_recebida: e.target.value })} />
                        </div>
                      )}
                      {(receiptItems[idx]?.status === 'ocorrencia' || receiptItems[idx]?.status === 'nao_recebido') && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo ocorrência</Label>
                            <Select value={receiptItems[idx]?.tipo_ocorrencia} onValueChange={v => updateReceiptItem(idx, { tipo_ocorrencia: v })}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {OCORRENCIA_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Observação</Label>
                            <Input value={receiptItems[idx]?.observacoes}
                              onChange={e => updateReceiptItem(idx, { observacoes: e.target.value })} />
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                <CheckCircle className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Confirmar Recebimento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
