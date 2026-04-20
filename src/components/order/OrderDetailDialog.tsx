import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/helpers";
import {
  FileText, Send, CheckCircle2, XCircle, Ban, CalendarClock,
  PackageCheck, AlertTriangle, ClipboardList, Edit3,
} from "lucide-react";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; observacoes: string | null; total: number;
  created_at: string; comprador_nome?: string;
  unidade_setor?: string | null;
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

type TimelineEvent = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  user: string;
  date: string;
  detail?: string;
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
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

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

  // Build the timeline of events for the order
  useEffect(() => {
    if (!open || !order) { setTimeline([]); return; }
    const buildTimeline = async () => {
      setLoadingTimeline(true);
      const fullOrder = order as any;

      const [
        { data: linkedReq },
        { data: approvalLogs },
        { data: receipt },
      ] = await Promise.all([
        supabase.from('requisitions')
          .select('id, user_id, created_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from('approval_log')
          .select('id, user_id, action, motivo, created_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true }),
        supabase.from('receipts')
          .select('id, user_id, status, observacoes, received_at, created_at, numero_nf')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const userIds = new Set<string>();
      userIds.add(order.user_id);
      if (linkedReq?.user_id) userIds.add(linkedReq.user_id);
      (approvalLogs || []).forEach((a: any) => userIds.add(a.user_id));
      if (receipt?.user_id) userIds.add(receipt.user_id);
      if (fullOrder.previsao_registrada_por) userIds.add(fullOrder.previsao_registrada_por);

      const { data: profilesData } = await supabase.from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));
      const profileMap: Record<string, string> = {};
      (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || '—'; });
      const nameOf = (uid?: string | null) => (uid && profileMap[uid]) || '—';

      const events: TimelineEvent[] = [];

      if (linkedReq) {
        events.push({
          key: `req-${linkedReq.id}`,
          icon: ClipboardList,
          iconClass: 'bg-muted text-muted-foreground',
          title: 'Solicitação vinculada',
          user: nameOf(linkedReq.user_id),
          date: linkedReq.created_at,
        });
      }

      events.push({
        key: 'created',
        icon: FileText,
        iconClass: 'bg-info/20 text-info',
        title: 'Pedido criado',
        user: nameOf(order.user_id),
        date: order.created_at,
      });

      const sentLog = (approvalLogs || []).find((a: any) => a.action === 'enviado' || a.action === 'aguardando_aprovacao');
      if (sentLog) {
        events.push({
          key: `sent-${sentLog.id}`,
          icon: Send,
          iconClass: 'bg-info/20 text-info',
          title: 'Enviado para aprovação',
          user: nameOf(sentLog.user_id),
          date: sentLog.created_at,
        });
      } else if (
        ['aguardando_aprovacao', 'aprovado', 'rejeitado', 'emitido', 'recebido', 'recebido_com_ocorrencia', 'cancelado'].includes(order.status)
      ) {
        events.push({
          key: 'sent-inferred',
          icon: Send,
          iconClass: 'bg-info/20 text-info',
          title: 'Enviado para aprovação',
          user: nameOf(order.user_id),
          date: order.created_at,
          detail: 'Data aproximada (criação do pedido)',
        });
      }

      (approvalLogs || []).forEach((a: any) => {
        if (a.action === 'aprovado') {
          events.push({
            key: `approved-${a.id}`, icon: CheckCircle2, iconClass: 'bg-success/20 text-success',
            title: 'Aprovado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo || undefined,
          });
        } else if (a.action === 'aprovado_com_alteracao') {
          events.push({
            key: `approved-edit-${a.id}`, icon: Edit3, iconClass: 'bg-success/20 text-success',
            title: 'Aprovado com alteração', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo || undefined,
          });
        } else if (a.action === 'rejeitado') {
          events.push({
            key: `rejected-${a.id}`, icon: XCircle, iconClass: 'bg-destructive/20 text-destructive',
            title: 'Rejeitado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo ? `Motivo: ${a.motivo}` : undefined,
          });
        } else if (a.action === 'cancelado') {
          events.push({
            key: `cancelled-${a.id}`, icon: Ban, iconClass: 'bg-destructive/20 text-destructive',
            title: 'Cancelado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo ? `Motivo: ${a.motivo}` : undefined,
          });
        }
      });

      if (fullOrder.previsao_entrega) {
        events.push({
          key: 'previsao', icon: CalendarClock, iconClass: 'bg-warning/20 text-warning',
          title: 'Previsão de entrega registrada',
          user: nameOf(fullOrder.previsao_registrada_por),
          date: fullOrder.updated_at || order.created_at,
          detail: `Entrega prevista para ${formatDate(fullOrder.previsao_entrega)}${fullOrder.obs_estoquista ? ` — ${fullOrder.obs_estoquista}` : ''}`,
        });
      }

      if (receipt) {
        const isOccurrence = receipt.status === 'recebido_com_ocorrencia';
        const summary = isOccurrence ? 'Ocorrência no recebimento' : 'Recebimento normal, sem ocorrência';
        events.push({
          key: `received-${receipt.id}`,
          icon: isOccurrence ? AlertTriangle : PackageCheck,
          iconClass: isOccurrence ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
          title: isOccurrence ? 'Recebido com ocorrência' : 'Recebido',
          user: nameOf(receipt.user_id),
          date: receipt.received_at || receipt.created_at,
          detail: [
            summary,
            receipt.numero_nf ? `NF ${receipt.numero_nf}` : 'NF não informada',
          ].filter(Boolean).join(' · '),
        });
      }

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTimeline(events);
      setLoadingTimeline(false);
    };
    buildTimeline();
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

  const renderTimelineTab = () => {
    if (loadingTimeline) return <p className="text-sm text-muted-foreground py-4">Carregando histórico...</p>;
    if (timeline.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhum evento registrado para este pedido.</p>;
    return (
      <div className="relative pl-2 py-2">
        <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />
        <ul className="space-y-4">
          {timeline.map(ev => {
            const Icon = ev.icon;
            return (
              <li key={ev.key} className="relative flex gap-4">
                <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ev.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ev.date)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">por <span className="font-medium text-foreground">{ev.user}</span></p>
                  {ev.detail && <p className="text-xs text-muted-foreground mt-1 italic">{ev.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
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
              <div><span className="text-muted-foreground">Unidade:</span> <span className="font-medium">{order.unidade_setor || '—'}</span></div>
              <div><span className="text-muted-foreground">Modo:</span> <span className="font-medium">{modoLabel(order.modo)}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</Badge></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="font-bold currency">{formatCurrency(order.total)}</span></div>
            </div>
            {order.observacoes && (
              <div className="text-sm"><span className="text-muted-foreground">Observações:</span> {order.observacoes}</div>
            )}
            <Tabs defaultValue="itens">
              <TabsList>
                <TabsTrigger value="itens">Itens do Pedido</TabsTrigger>
                {hasReceipt && <TabsTrigger value="recebimento">Recebimento</TabsTrigger>}
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="itens">{renderItemsTable()}</TabsContent>
              {hasReceipt && <TabsContent value="recebimento">{renderReceiptTab()}</TabsContent>}
              <TabsContent value="historico">{renderTimelineTab()}</TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
