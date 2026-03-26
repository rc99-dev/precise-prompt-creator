import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Copy, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; observacoes: string | null; total: number;
  created_at: string; profiles?: { full_name: string } | null;
};

type OrderItem = {
  id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  observacoes: string | null;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

export default function OrderHistoryPage() {
  const { role, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });
    setOrders((data || []) as unknown as Order[]);
  };

  useEffect(() => { fetchOrders(); }, []);

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
    fetchOrders();
  };

  const exportCSV = async (order: Order) => {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*, products(nome, unidade_medida), suppliers(razao_social)')
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

  const statusLabel = (s: string) => s === 'rascunho' ? 'Rascunho' : s === 'finalizado' ? 'Finalizado' : 'Enviado';
  const statusVariant = (s: string): "default" | "secondary" | "outline" => s === 'finalizado' ? 'default' : s === 'enviado' ? 'secondary' : 'outline';
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
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Número</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Modo</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma ordem encontrada.</td></tr>
                ) : filtered.map(o => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{o.numero}</td>
                    <td className="py-3 px-4 text-muted-foreground">{formatDate(o.created_at)}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{modoLabel(o.modo)}</td>
                    <td className="py-3 px-4 text-right currency font-medium">{formatCurrency(o.total)}</td>
                    <td className="py-3 px-4 text-center"><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => viewOrder(o)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => duplicateOrder(o)}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => exportCSV(o)}><Download className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ordem {selectedOrder?.numero}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{formatDate(selectedOrder.created_at)}</span></div>
                <div><span className="text-muted-foreground">Modo:</span> <span className="font-medium">{modoLabel(selectedOrder.modo)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusVariant(selectedOrder.status)}>{statusLabel(selectedOrder.status)}</Badge></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold currency">{formatCurrency(selectedOrder.total)}</span></div>
              </div>
              {selectedOrder.observacoes && (
                <div className="text-sm"><span className="text-muted-foreground">Observações:</span> {selectedOrder.observacoes}</div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
