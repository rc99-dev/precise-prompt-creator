import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Package, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type EmittedOrder = {
  id: string; numero: string; status: string; total: number; created_at: string;
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

const fetchEmittedOrders = async () => {
  const { data, error } = await supabase.from('purchase_orders').select('id, numero, status, total, created_at')
    .in('status', ['emitido']).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as EmittedOrder[];
};

export default function ReceiptsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<EmittedOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemForReceipt[]>([]);
  const [receiptItems, setReceiptItems] = useState<ReceiptItemForm[]>([]);
  const [numeroNF, setNumeroNF] = useState("");
  const [obsGeral, setObsGeral] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['receipt-orders'],
    queryFn: fetchEmittedOrders,
    staleTime: 2 * 60 * 1000,
  });

  const openReceipt = async (order: EmittedOrder) => {
    setSelectedOrder(order);
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
    toast.success("Recebimento registrado!");
    setSaving(false);
    setSelectedOrder(null);
    queryClient.invalidateQueries({ queryKey: ['receipt-orders'] });
  };

  const OCORRENCIA_TIPOS = ['avaria', 'divergencia_quantidade', 'produto_errado', 'nf_incorreta', 'outro'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recebimentos</h1>
        <p className="text-muted-foreground text-sm mt-1">Registre o recebimento de pedidos emitidos</p>
      </div>

      {isLoading ? (
        <Card><CardContent><TableSkeleton columns={3} rows={4} /></CardContent></Card>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Truck className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhum pedido aguardando recebimento</p>
            <p className="text-xs mt-1">Pedidos emitidos aparecerão aqui para conferência</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <Card key={o.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openReceipt(o)}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{o.numero}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(o.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold currency">{formatCurrency(o.total)}</p>
                  <Badge className="bg-info/20 text-info">Emitido</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
                            <SelectItem value="recebido">Recebido</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                            <SelectItem value="ocorrencia">Ocorrência</SelectItem>
                            <SelectItem value="nao_recebido">Não recebido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qtd recebida</Label>
                        <Input type="number" step="0.01" value={receiptItems[idx]?.quantidade_recebida}
                          onChange={e => updateReceiptItem(idx, { quantidade_recebida: e.target.value })} />
                      </div>
                      {receiptItems[idx]?.status !== 'recebido' && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo ocorrência</Label>
                            <Select value={receiptItems[idx]?.tipo_ocorrencia} onValueChange={v => updateReceiptItem(idx, { tipo_ocorrencia: v })}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {OCORRENCIA_TIPOS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
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
