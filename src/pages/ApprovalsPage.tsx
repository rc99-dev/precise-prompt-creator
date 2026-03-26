import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import { formatCurrency, formatDate, statusLabels, statusColors } from "@/lib/helpers";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; total: number; created_at: string; observacoes: string | null;
};

type OrderItem = {
  id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchOrders = async () => {
    const { data } = await supabase.from('purchase_orders').select('*')
      .eq('status', 'aguardando_aprovacao').order('created_at', { ascending: false });
    setOrders((data || []) as Order[]);
  };

  useEffect(() => { fetchOrders(); }, []);

  const viewDetails = async (order: Order) => {
    setDetailOrder(order);
    const { data } = await supabase.from('purchase_order_items')
      .select('*, products(nome, unidade_medida), suppliers(razao_social)')
      .eq('order_id', order.id);
    setOrderItems((data || []) as unknown as OrderItem[]);
  };

  const handleApprove = async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders').update({
      status: 'aprovado', approved_by: user!.id, approved_at: new Date().toISOString(),
    } as any).eq('id', orderId);
    if (error) { toast.error(error.message); return; }

    await supabase.from('approval_log').insert({
      order_id: orderId, user_id: user!.id, action: 'aprovado',
    } as any);

    toast.success("Pedido aprovado!");
    setDetailOrder(null);
    fetchOrders();
  };

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) { toast.error("Informe o motivo."); return; }
    const { error } = await supabase.from('purchase_orders').update({
      status: 'rejeitado', rejected_reason: rejectReason,
    } as any).eq('id', rejectDialog);
    if (error) { toast.error(error.message); return; }

    await supabase.from('approval_log').insert({
      order_id: rejectDialog, user_id: user!.id, action: 'rejeitado', motivo: rejectReason,
    } as any);

    toast.success("Pedido rejeitado.");
    setRejectDialog(null); setRejectReason(""); setDetailOrder(null);
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aprovações</h1>
        <p className="text-muted-foreground text-sm mt-1">Fila de pedidos aguardando aprovação</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhum pedido aguardando aprovação</p>
            <p className="text-xs mt-1">Quando um comprador enviar um pedido, ele aparecerá aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <Card key={o.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-warning/10 p-2">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-semibold">{o.numero}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(o.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold currency">{formatCurrency(o.total)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => viewDetails(o)}>
                      <Eye className="h-3 w-3 mr-1" />Detalhes
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(o.id)} className="bg-success hover:bg-success/90">
                      <CheckCircle className="h-3 w-3 mr-1" />Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectDialog(o.id)}>
                      <XCircle className="h-3 w-3 mr-1" />Rejeitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pedido {detailOrder?.numero}</DialogTitle></DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{formatDate(detailOrder.created_at)}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold currency">{formatCurrency(detailOrder.total)}</span></div>
                <div><span className="text-muted-foreground">Modo:</span> <span className="font-medium capitalize">{detailOrder.modo}</span></div>
              </div>
              {detailOrder.observacoes && (
                <p className="text-sm text-muted-foreground">Obs: {detailOrder.observacoes}</p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">Qtd</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Preço Unit.</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map(i => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{i.products?.nome}</td>
                      <td className="py-2 text-muted-foreground">{i.suppliers?.razao_social || '—'}</td>
                      <td className="py-2 text-center">{i.quantidade} {i.products?.unidade_medida}</td>
                      <td className="py-2 text-right currency">{formatCurrency(i.preco_unitario)}</td>
                      <td className="py-2 text-right currency font-medium">{formatCurrency(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="destructive" onClick={() => { setRejectDialog(detailOrder.id); }}>
                  <XCircle className="h-4 w-4 mr-2" />Rejeitar
                </Button>
                <Button onClick={() => handleApprove(detailOrder.id)} className="bg-success hover:bg-success/90">
                  <CheckCircle className="h-4 w-4 mr-2" />Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo da rejeição *</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Informe o motivo..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject}>Confirmar Rejeição</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
