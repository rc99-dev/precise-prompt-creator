import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/helpers";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; observacoes: string | null; total: number;
  created_at: string; comprador_nome?: string;
};

type OrderItem = {
  id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  observacoes: string | null;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

type ReceiptData = {
  numero: string; numero_nf: string | null; status: string;
  observacoes: string | null; received_at: string | null; user_id: string;
  estoquista_nome?: string;
  items: {
    status: string; quantidade_recebida: number | null;
    tipo_ocorrencia: string | null; observacoes: string | null;
    product_nome: string; product_unidade: string; quantidade_esperada: number;
  }[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  orderItems: OrderItem[];
  statusLabel: (s: string) => string;
  statusBadgeClass: (s: string) => string;
  modoLabel: (m: string) => string;
}

export default function OrderDetailDialog({ open, onOpenChange, order, orderItems, statusLabel, statusBadgeClass, modoLabel }: Props) {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const hasReceipt = order && (order.status === 'recebido' || order.status === 'recebido_com_ocorrencia');

  useEffect(() => {
    if (!open || !order || !hasReceipt) { setReceiptData(null); return; }
    const fetchReceipt = async () => {
      setLoadingReceipt(true);
      const { data: receipt } = await supabase.from('receipts').select('*')
        .eq('order_id', order.id).limit(1).single();
      if (!receipt) { setLoadingReceipt(false); return; }

      const [{ data: items }, { data: profile }] = await Promise.all([
        supabase.from('receipt_items').select('*, purchase_order_items(quantidade, products(nome, unidade_medida))')
          .eq('receipt_id', receipt.id) as any,
        supabase.from('profiles').select('full_name').eq('user_id', receipt.user_id).single(),
      ]);

      setReceiptData({
        numero: receipt.numero,
        numero_nf: receipt.numero_nf,
        status: receipt.status,
        observacoes: receipt.observacoes,
        received_at: receipt.received_at,
        user_id: receipt.user_id,
        estoquista_nome: profile?.full_name || '—',
        items: (items || []).map((ri: any) => ({
          status: ri.status,
          quantidade_recebida: ri.quantidade_recebida,
          tipo_ocorrencia: ri.tipo_ocorrencia,
          observacoes: ri.observacoes,
          product_nome: ri.purchase_order_items?.products?.nome || '—',
          product_unidade: ri.purchase_order_items?.products?.unidade_medida || '',
          quantidade_esperada: ri.purchase_order_items?.quantidade || 0,
        })),
      });
      setLoadingReceipt(false);
    };
    fetchReceipt();
  }, [open, order?.id]);

  const receiptItemStatusLabel = (s: string) => {
    const m: Record<string, string> = { recebido: 'Conforme', parcial: 'Parcial', ocorrencia: 'Ocorrência', nao_recebido: 'Não recebido' };
    return m[s] || s;
  };

  const receiptItemStatusClass = (s: string) => {
    if (s === 'recebido') return 'bg-success/20 text-success';
    if (s === 'parcial') return 'bg-warning/20 text-warning';
    return 'bg-destructive/20 text-destructive';
  };

  const renderItemsTable = () => (
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
  );

  const renderReceiptTab = () => {
    if (loadingReceipt) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;
    if (!receiptData) return <p className="text-sm text-muted-foreground py-4">Dados de recebimento não encontrados.</p>;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">NF:</span> <span className="font-medium">{receiptData.numero_nf || '—'}</span></div>
          <div><span className="text-muted-foreground">Recebido em:</span> <span className="font-medium">{receiptData.received_at ? formatDateTime(receiptData.received_at) : '—'}</span></div>
          <div><span className="text-muted-foreground">Assistente de Suprimentos:</span> <span className="font-medium">{receiptData.estoquista_nome}</span></div>
          <div><span className="text-muted-foreground">Obs:</span> <span className="font-medium">{receiptData.observacoes || '—'}</span></div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground">Produto</th>
              <th className="text-center py-2 font-medium text-muted-foreground">Qtd Esperada</th>
              <th className="text-center py-2 font-medium text-muted-foreground">Qtd Recebida</th>
              <th className="text-center py-2 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-2 font-medium text-muted-foreground">Ocorrência</th>
            </tr>
          </thead>
          <tbody>
            {receiptData.items.map((ri, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2 font-medium">{ri.product_nome}</td>
                <td className="py-2 text-center">{ri.quantidade_esperada} {ri.product_unidade}</td>
                <td className="py-2 text-center">{ri.quantidade_recebida ?? '—'}</td>
                <td className="py-2 text-center"><Badge className={receiptItemStatusClass(ri.status)}>{receiptItemStatusLabel(ri.status)}</Badge></td>
                <td className="py-2 text-muted-foreground">{ri.tipo_ocorrencia?.replace(/_/g, ' ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ordem {order?.numero}</DialogTitle></DialogHeader>
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{formatDate(order.created_at)}</span></div>
              <div><span className="text-muted-foreground">Modo:</span> <span className="font-medium">{modoLabel(order.modo)}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</Badge></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="font-bold currency">{formatCurrency(order.total)}</span></div>
            </div>
            {order.observacoes && (
              <div className="text-sm"><span className="text-muted-foreground">Observações:</span> {order.observacoes}</div>
            )}
            {hasReceipt ? (
              <Tabs defaultValue="itens">
                <TabsList>
                  <TabsTrigger value="itens">Itens do Pedido</TabsTrigger>
                  <TabsTrigger value="recebimento">Recebimento</TabsTrigger>
                </TabsList>
                <TabsContent value="itens">{renderItemsTable()}</TabsContent>
                <TabsContent value="recebimento">{renderReceiptTab()}</TabsContent>
              </Tabs>
            ) : (
              renderItemsTable()
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
