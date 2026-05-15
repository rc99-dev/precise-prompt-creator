import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Eye, Copy, Download, FileText, Pencil, Trash2, Calendar, XCircle, Ban, Filter, FileDown, CheckCircle2, X } from "lucide-react";
import { formatCurrency, formatDate, statusColors } from "@/lib/helpers";
import { generateOrderPDF, generateOrderPDFBySupplier, generateMultipleOrdersPDF, TimelineEntry } from "@/lib/pdfGenerator";
import { UNIDADES, TITULOS_SOLICITACAO } from "@/lib/constants";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrderDetailDialog from "@/components/order/OrderDetailDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";
import { invalidateOrderQueries } from "@/lib/queryInvalidation";
import { resolveUserNames, resolveUserName } from "@/lib/userNames";
import { exportSectionExcel } from "@/lib/reportExports";

type Order = {
  id: string; numero: string; user_id: string; modo: string;
  status: string; observacoes: string | null; total: number;
  created_at: string; profiles?: { full_name: string } | null;
  comprador_nome?: string;
  unidade_setor?: string | null;
  has_requisition?: boolean;
  titulo?: string | null;
};

type OrderItem = {
  id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  observacoes: string | null;
  products?: { nome: string; unidade_medida: string } | null;
  suppliers?: { razao_social: string } | null;
};

const fetchOrders = async () => {
  const [{ data: orders, error }, { data: profiles }, { data: linkedReqs }] = await Promise.all([
    supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('user_id, full_name'),
    supabase.from('requisitions').select('order_id').not('order_id', 'is', null),
  ]);
  if (error) throw error;
  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
  const reqOrderIds = new Set((linkedReqs || []).map((r: any) => r.order_id));
  return (orders || []).map((o: any) => ({
    ...o,
    comprador_nome: profileMap[o.user_id] || '—',
    has_requisition: reqOrderIds.has(o.id),
  })) as unknown as Order[];
};

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [nfSearch, setNfSearch] = useState("");
  const [tituloFilter, setTituloFilter] = useState("");
  const [unidadeFilter, setUnidadeFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingMulti, setExportingMulti] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previsaoTarget, setPrevisaoTarget] = useState<Order | null>(null);
  const [previsaoData, setPrevisaoData] = useState("");
  const [previsaoObs, setPrevisaoObs] = useState("");
  const [savingPrevisao, setSavingPrevisao] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [batchReceiveOpen, setBatchReceiveOpen] = useState(false);
  const [batchReceiveDate, setBatchReceiveDate] = useState("");
  const [batchReceiving, setBatchReceiving] = useState(false);
  const [batchForecastOpen, setBatchForecastOpen] = useState(false);
  const [batchForecastDate, setBatchForecastDate] = useState("");
  const [batchForecastObs, setBatchForecastObs] = useState("");
  const [batchForecasting, setBatchForecasting] = useState(false);

  const { role } = useAuth();

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['order-history'],
    queryFn: fetchOrders,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: nfMatchOrderIds } = useQuery({
    queryKey: ['nf-search', nfSearch],
    queryFn: async () => {
      if (!nfSearch.trim()) return null;
      const { data } = await supabase.from('receipts').select('order_id').ilike('numero_nf', `%${nfSearch.trim()}%`);
      return new Set((data || []).map((r: any) => r.order_id));
    },
    enabled: !!nfSearch.trim(),
    staleTime: 30 * 1000,
  });

  const titulosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.titulo) set.add(o.titulo); });
    return Array.from(set).sort();
  }, [orders]);

  const filtered = orders.filter(o => {
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (search && !o.numero.toLowerCase().includes(search.toLowerCase())) return false;
    if (tituloFilter && o.titulo !== tituloFilter) return false;
    if (unidadeFilter !== 'todos' && o.unidade_setor !== unidadeFilter) return false;
    if (dateFrom && new Date(o.created_at) < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && new Date(o.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
    if (valorMin && o.total < parseFloat(valorMin)) return false;
    if (valorMax && o.total > parseFloat(valorMax)) return false;
    if (nfSearch.trim() && nfMatchOrderIds && !nfMatchOrderIds.has(o.id)) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectedOrders = filtered.filter(o => selectedIds.has(o.id));
  const isMaster = role === 'master';
  const isPrivileged = isMaster || role === 'comprador' || role === 'estoquista';
  const canExportMulti = isPrivileged
    ? selectedOrders.length >= 1
    : selectedOrders.length > 1 && selectedOrders.every(o => o.status === selectedOrders[0].status);
  const canBatchReceive = (isMaster || role === 'estoquista') && selectedOrders.length >= 1 &&
    selectedOrders.every(o => o.status === 'aprovado' || o.status === 'emitido');
  const canBatchForecast = (isMaster || role === 'estoquista' || role === 'comprador') && selectedOrders.length >= 1 &&
    selectedOrders.every(o => o.status === 'emitido');

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
      // Guard: if items already exist for the new order, do NOT insert again (prevents double inserts on rapid clicks / Strict Mode)
      const { count: existingCount } = await supabase
        .from('purchase_order_items')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', newOrder.id);
      if ((existingCount || 0) === 0) {
        const newItems = items.map(i => ({
          order_id: newOrder.id, product_id: i.product_id, supplier_id: i.supplier_id,
          quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal, observacoes: i.observacoes,
        }));
        await supabase.from('purchase_order_items').insert(newItems);
      }
    }
    toast.success("Ordem duplicada como rascunho!");
    invalidateOrderQueries(queryClient);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Guard: only rascunho or rejeitado can be deleted (also enforced by RLS at DB level)
    if (deleteTarget.status !== 'rascunho' && deleteTarget.status !== 'rejeitado') {
      toast.error("Pedidos emitidos, aprovados ou recebidos não podem ser excluídos. Reprove ou cancele primeiro.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    // Unlink any requisitions referencing this order to avoid FK violation
    await supabase.from('requisitions').update({ order_id: null, status: 'pendente' } as any).eq('order_id', deleteTarget.id);
    const { error: itemsError } = await supabase.from('purchase_order_items').delete().eq('order_id', deleteTarget.id);
    if (itemsError) {
      toast.error("Não foi possível excluir os itens deste pedido. Status atual não permite exclusão.");
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from('purchase_orders').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error("Pedidos emitidos, aprovados ou recebidos não podem ser excluídos. Reprove ou cancele primeiro.");
    } else {
      toast.success("Pedido excluído!");
    }
    setDeleting(false);
    setDeleteTarget(null);
    invalidateOrderQueries(queryClient);
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

  const fetchTimeline = async (order: Order): Promise<TimelineEntry[]> => {
    if (!['aprovado', 'emitido', 'recebido', 'recebido_com_ocorrencia'].includes(order.status)) return [];
    const [{ data: logs }, { data: receipt }] = await Promise.all([
      supabase.from('approval_log').select('user_id, action, motivo, created_at').eq('order_id', order.id).order('created_at'),
      supabase.from('receipts').select('user_id, status, observacoes, received_at, created_at, numero_nf').eq('order_id', order.id).order('created_at').limit(1).maybeSingle(),
    ]);
    const userIds = new Set<string>([order.user_id]);
    (logs || []).forEach((l: any) => { if (l.user_id) userIds.add(l.user_id); });
    if (receipt?.user_id) userIds.add(receipt.user_id);
    const nameMap = await resolveUserNames(Array.from(userIds));
    const events: TimelineEntry[] = [];
    events.push({ date: order.created_at, user: nameMap[order.user_id] || '—', action: 'Pedido criado' });
    (logs || []).forEach((l: any) => {
      const map: Record<string, string> = { aprovado: 'Aprovado', aprovado_com_alteracao: 'Aprovado com alteração', rejeitado: 'Rejeitado', cancelado: 'Cancelado', enviado: 'Enviado para aprovação', aguardando_aprovacao: 'Enviado para aprovação' };
      events.push({ date: l.created_at, user: nameMap[l.user_id] || '—', action: map[l.action] || l.action, detail: l.motivo || undefined });
    });
    if (receipt) {
      events.push({
        date: receipt.received_at || receipt.created_at,
        user: nameMap[receipt.user_id] || '—',
        action: receipt.status === 'recebido_com_ocorrencia' ? 'Recebido com ocorrência' : 'Recebido',
        detail: [receipt.numero_nf ? `NF ${receipt.numero_nf}` : undefined, receipt.observacoes].filter(Boolean).join(' · ') || undefined,
      });
    }
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  };

  const fetchPDFData = async (order: Order, forceSaldo = false) => {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*, products(nome, unidade_medida, codigo_interno), suppliers(razao_social, cnpj, telefone, cidade)')
      .eq('order_id', order.id);
    if (!items || items.length === 0) { toast.error("Sem itens para exportar."); return null; }
    const { data: buyerProfileRaw } = await supabase.from('profiles').select('full_name, unidade, unidade_setor').eq('user_id', order.user_id).maybeSingle();
    const buyerName = await resolveUserName(order.user_id);
    const buyerProfile = { ...(buyerProfileRaw || {}), full_name: buyerName } as any;
    let aprovadorName: string | null = null;
    if (order.status === 'aprovado' || order.status === 'emitido' || order.status === 'recebido') {
      const { data: log } = await supabase.from('approval_log').select('user_id').eq('order_id', order.id).eq('action', 'aprovado').limit(1).maybeSingle();
      if (log?.user_id) aprovadorName = await resolveUserName(log.user_id);
    }

    const saldoMap: Record<string, number> = {};
    let solicitante: string | null = null;
    let setor: string | null = null;
    const isInternalPDF = order.status === 'rascunho' || order.status === 'aguardando_aprovacao';
    const includeSaldoData = isInternalPDF || forceSaldo;
    if (includeSaldoData) {
      const { data: linkedReqs } = await supabase.from('requisitions')
        .select('id, user_id, setor').eq('order_id', order.id);
      if (linkedReqs && linkedReqs.length > 0) {
        const reqIds = linkedReqs.map((r: any) => r.id);
        setor = linkedReqs[0].setor;
        solicitante = await resolveUserName(linkedReqs[0].user_id);
        const { data: reqItems } = await supabase.from('requisition_items').select('product_id, saldo').in('requisition_id', reqIds);
        // Aggregate saldo across all linked requisitions for the same product
        (reqItems || []).forEach((ri: any) => {
          saldoMap[ri.product_id] = (saldoMap[ri.product_id] || 0) + Number(ri.saldo || 0);
        });
      }
    }

    const timeline = await fetchTimeline(order);
    return { items, buyerProfile, aprovadorName, saldoMap, solicitante, setor, isInternalPDF: includeSaldoData, timeline };
  };

  const markAsEmitted = async (order: Order) => {
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
      invalidateOrderQueries(queryClient);
    }
  };

  const exportPDF = async (order: Order, forceSaldo = false) => {
    const result = await fetchPDFData(order, forceSaldo);
    if (!result) return;
    const { items, buyerProfile, aprovadorName, saldoMap, solicitante, setor, isInternalPDF } = result;
    const mainSupplier = items[0]?.suppliers as any;
    generateOrderPDF({
      numero: order.numero, created_at: order.created_at, observacoes: order.observacoes,
      total: order.total, unidadeSolicitante: (order as any).unidade_setor || undefined,
      supplier: mainSupplier ? { razao_social: mainSupplier.razao_social, cnpj: mainSupplier.cnpj, telefone: mainSupplier.telefone, cidade: mainSupplier.cidade } : null,
      items: items.map(i => ({
        codigo: (i.products as any)?.codigo_interno, descricao: (i.products as any)?.nome || "",
        unidade: (i.products as any)?.unidade_medida || "", quantidade: i.quantidade,
        preco_unitario: i.preco_unitario, subtotal: i.subtotal,
        saldo: saldoMap[i.product_id],
      })),
      comprador: buyerProfile?.full_name, aprovador: aprovadorName, approved_at: (order as any).approved_at,
      showSaldo: isInternalPDF,
      solicitante: solicitante || undefined,
      setor: setor || undefined,
      filenameSuffix: forceSaldo ? 'com_saldo' : undefined,
    });
    if (!forceSaldo) await markAsEmitted(order);
    toast.success("PDF gerado!");
  };

  const exportPDFBySupplier = async (order: Order) => {
    const result = await fetchPDFData(order);
    if (!result) return;
    const { items, buyerProfile, aprovadorName, saldoMap, solicitante, setor, isInternalPDF } = result;
    generateOrderPDFBySupplier({
      numero: order.numero, created_at: order.created_at, observacoes: order.observacoes,
      unidadeSolicitante: (order as any).unidade_setor || undefined,
      items: items.map(i => {
        const sup = i.suppliers as any;
        return {
          codigo: (i.products as any)?.codigo_interno, descricao: (i.products as any)?.nome || "",
          unidade: (i.products as any)?.unidade_medida || "", quantidade: i.quantidade,
          preco_unitario: i.preco_unitario, subtotal: i.subtotal,
          supplier_id: i.supplier_id,
          supplier_info: sup ? { razao_social: sup.razao_social, cnpj: sup.cnpj, telefone: sup.telefone, cidade: sup.cidade } : null,
          saldo: saldoMap[i.product_id],
        };
      }),
      comprador: buyerProfile?.full_name, aprovador: aprovadorName, approved_at: (order as any).approved_at,
      showSaldo: isInternalPDF,
      solicitante: solicitante || undefined,
      setor: setor || undefined,
    });
    await markAsEmitted(order);
    toast.success("PDFs por fornecedor gerados!");
  };

  const exportSelectedPDF = async () => {
    if (selectedOrders.length < 1) return;
    if (!canExportMulti) {
      toast.error("Selecione pedidos com o mesmo status.");
      return;
    }
    setExportingMulti(true);
    try {
      const datas = await Promise.all(selectedOrders.map(async (o) => {
        const r = await fetchPDFData(o);
        if (!r) return null;
        const { items, buyerProfile, aprovadorName, saldoMap, solicitante, setor, isInternalPDF, timeline } = r;
        const mainSupplier = items[0]?.suppliers as any;
        return {
          numero: o.numero, created_at: o.created_at, observacoes: o.observacoes,
          total: o.total, unidadeSolicitante: (o as any).unidade_setor || undefined,
          supplier: mainSupplier ? { razao_social: mainSupplier.razao_social, cnpj: mainSupplier.cnpj, telefone: mainSupplier.telefone, cidade: mainSupplier.cidade } : null,
          items: items.map((i: any) => ({
            codigo: i.products?.codigo_interno, descricao: i.products?.nome || "",
            unidade: i.products?.unidade_medida || "", quantidade: i.quantidade,
            preco_unitario: i.preco_unitario, subtotal: i.subtotal, saldo: saldoMap[i.product_id],
          })),
          comprador: buyerProfile?.full_name, aprovador: aprovadorName, approved_at: (o as any).approved_at,
          showSaldo: isInternalPDF, solicitante: solicitante || undefined, setor: setor || undefined,
          timeline,
        };
      }));
      const valid = datas.filter(Boolean) as any[];
      if (!valid.length) { toast.error("Nenhum pedido válido."); return; }
      generateMultipleOrdersPDF(valid);

      // Mirror individual export: aprovado -> emitido + notify estoquistas
      const toEmit = selectedOrders.filter(o => o.status === 'aprovado');
      if (toEmit.length > 0) {
        await supabase.from('purchase_orders').update({ status: 'emitido' } as any).in('id', toEmit.map(o => o.id));
        const { data: estoquistas } = await supabase.from('user_roles').select('user_id').eq('role', 'estoquista');
        if (estoquistas?.length) {
          const notifs = estoquistas.flatMap(e => toEmit.map(o => ({
            user_id: e.user_id,
            titulo: 'Nova ordem emitida',
            mensagem: `Pedido ${o.numero} foi emitido — aguardando confirmação do fornecedor.`,
            tipo: 'info', lida: false,
          })));
          await supabase.from('notifications').insert(notifs);
        }
        invalidateOrderQueries(queryClient);
      }

      toast.success(`${valid.length} pedidos exportados em PDF único!${toEmit.length ? ` ${toEmit.length} marcados como emitidos.` : ''}`);
      setSelectedIds(new Set());
    } finally {
      setExportingMulti(false);
    }
  };

  const handleSalvarPrevisao = async () => {
    if (!previsaoTarget || !previsaoData) { toast.error("Informe a data prevista."); return; }
    setSavingPrevisao(true);
    console.info('[previsao] salvando', {
      orderId: previsaoTarget.id,
      numero: previsaoTarget.numero,
      previsaoData,
      previsaoObs,
    });
    const { error: updErr } = await supabase.from('purchase_orders').update({
      previsao_entrega: previsaoData,
      obs_estoquista: previsaoObs || null,
      previsao_registrada_por: user?.id || null,
    } as any).eq('id', previsaoTarget.id);
    if (updErr) {
      console.error('[previsao] erro ao salvar', updErr);
      toast.error(`Erro ao salvar previsão: ${updErr.message}`);
      setSavingPrevisao(false);
      return;
    }
    const { data: estoquistas } = await supabase.from('user_roles').select('user_id').eq('role', 'estoquista');
    if (estoquistas?.length) {
      await supabase.from('notifications').insert(estoquistas.map(e => ({
        user_id: e.user_id,
        titulo: 'Previsão de entrega registrada',
        mensagem: `Pedido ${previsaoTarget.numero} — Entrega prevista para ${new Date(previsaoData).toLocaleDateString('pt-BR')}. ${previsaoObs || ''}`,
        tipo: 'info', lida: false,
      })));
    }
    toast.success("Previsão registrada! Assistente de suprimentos notificado.");
    setSavingPrevisao(false);
    setPrevisaoTarget(null);
    setPrevisaoData("");
    setPrevisaoObs("");
    invalidateOrderQueries(queryClient);
  };

  const handleMasterReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error("Informe o motivo da reprovação."); return; }
    setRejecting(true);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'rejeitado', rejected_reason: rejectReason,
    }).eq('id', rejectTarget.id);
    if (error) { toast.error(error.message); setRejecting(false); return; }
    // Log action
    await supabase.from('approval_log').insert({
      order_id: rejectTarget.id, user_id: user!.id,
      action: 'rejeitado', motivo: rejectReason,
    });
    // Notify the buyer
    await supabase.from('notifications').insert({
      user_id: rejectTarget.user_id,
      titulo: 'Pedido reprovado pelo master',
      mensagem: `Pedido ${rejectTarget.numero} foi reprovado. Motivo: ${rejectReason}`,
      tipo: 'alerta', lida: false,
    });
    toast.success("Pedido reprovado!");
    setRejecting(false);
    setRejectTarget(null);
    setRejectReason("");
    invalidateOrderQueries(queryClient);
  };

  const handleMasterCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    setCancelling(true);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'cancelado',
      obs_estoquista: `[CANCELADO PELO MASTER] ${cancelReason}`,
    } as any).eq('id', cancelTarget.id);
    if (error) { toast.error(error.message); setCancelling(false); return; }
    await supabase.from('approval_log').insert({
      order_id: cancelTarget.id, user_id: user!.id,
      action: 'cancelado', motivo: cancelReason,
    });
    await supabase.from('notifications').insert({
      user_id: cancelTarget.user_id,
      titulo: 'Pedido cancelado',
      mensagem: `Pedido ${cancelTarget.numero} foi cancelado pelo master. Motivo: ${cancelReason}`,
      tipo: 'alerta', lida: false,
    });
    toast.success("Pedido cancelado!");
    setCancelling(false);
    setCancelTarget(null);
    setCancelReason("");
    invalidateOrderQueries(queryClient);
  };

  const handleBatchReceive = async () => {
    if (!batchReceiveDate) { toast.error("Informe a data de recebimento."); return; }
    if (!selectedOrders.length) return;
    setBatchReceiving(true);
    try {
      const ids = selectedOrders.map(o => o.id);
      const receivedAt = new Date(`${batchReceiveDate}T12:00:00`).toISOString();
      const { error } = await supabase.from('purchase_orders').update({ status: 'recebido' } as any).in('id', ids);
      if (error) { toast.error(error.message); return; }
      // approval_log entries
      await supabase.from('approval_log').insert(selectedOrders.map(o => ({
        order_id: o.id, user_id: user!.id, action: 'recebido',
        motivo: `Recebimento em lote (${selectedOrders.length} pedidos) — data: ${new Date(batchReceiveDate).toLocaleDateString('pt-BR')}`,
      })));
      // receipts
      const numbers = await Promise.all(selectedOrders.map(async () => {
        const { data } = await supabase.rpc('generate_receipt_number');
        return data as unknown as string;
      }));
      await supabase.from('receipts').insert(selectedOrders.map((o, i) => ({
        order_id: o.id, user_id: user!.id, numero: numbers[i] || `REC-${Date.now()}-${i}`,
        status: 'recebido', received_at: receivedAt,
        observacoes: 'Recebimento em lote',
      })));
      // notify buyers
      await supabase.from('notifications').insert(selectedOrders.map(o => ({
        user_id: o.user_id,
        titulo: 'Pedido marcado como recebido',
        mensagem: `Pedido ${o.numero} foi marcado como recebido em ${new Date(batchReceiveDate).toLocaleDateString('pt-BR')}.`,
        tipo: 'info', lida: false,
      })));
      toast.success(`${selectedOrders.length} pedido(s) marcado(s) como recebido(s)!`);
      setBatchReceiveOpen(false);
      setBatchReceiveDate("");
      setSelectedIds(new Set());
      invalidateOrderQueries(queryClient);
    } finally {
      setBatchReceiving(false);
    }
  };

  const handleBatchForecast = async () => {
    if (!batchForecastDate) { toast.error("Informe a data prevista."); return; }
    if (!selectedOrders.length) return;
    setBatchForecasting(true);
    try {
      const ids = selectedOrders.map(o => o.id);
      const { error } = await supabase.from('purchase_orders').update({
        previsao_entrega: batchForecastDate,
        obs_estoquista: batchForecastObs || null,
        previsao_registrada_por: user?.id || null,
      } as any).in('id', ids);
      if (error) { toast.error(error.message); return; }
      const { data: estoquistas } = await supabase.from('user_roles').select('user_id').eq('role', 'estoquista');
      if (estoquistas?.length) {
        const notifs: any[] = [];
        selectedOrders.forEach(o => {
          estoquistas.forEach(e => notifs.push({
            user_id: e.user_id,
            titulo: 'Previsão de entrega registrada',
            mensagem: `Pedido ${o.numero} — Entrega prevista para ${new Date(batchForecastDate).toLocaleDateString('pt-BR')}. ${batchForecastObs || ''}`,
            tipo: 'info', lida: false,
          }));
        });
        await supabase.from('notifications').insert(notifs);
      }
      toast.success(`Previsão registrada em ${selectedOrders.length} pedido(s)!`);
      setBatchForecastOpen(false);
      setBatchForecastDate("");
      setBatchForecastObs("");
      setSelectedIds(new Set());
      invalidateOrderQueries(queryClient);
    } finally {
      setBatchForecasting(false);
    }
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

      <div className="flex gap-3 flex-wrap items-center">
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
            <SelectItem value="recebido_com_ocorrencia">Recebido c/ Ocorrência</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}>
          <Filter className="h-4 w-4 mr-2" />{showFilters ? 'Ocultar filtros' : 'Mais filtros'}
        </Button>
        {!isPrivileged && selectedOrders.length > 1 && (
          <Button size="sm" onClick={exportSelectedPDF} disabled={!canExportMulti || exportingMulti}>
            <FileDown className="h-4 w-4 mr-2" />
            {exportingMulti ? 'Gerando...' : `Exportar ${selectedOrders.length} em PDF`}
          </Button>
        )}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <Select value={tituloFilter || 'todos'} onValueChange={v => setTituloFilter(v === 'todos' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TITULOS_SOLICITACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Unidade</label>
              <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Buscar por NF</label>
              <Input placeholder="Nº da nota fiscal" value={nfSearch} onChange={e => setNfSearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Período</label>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor mínimo</label>
              <Input type="number" placeholder="0,00" value={valorMin} onChange={e => setValorMin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Valor máximo</label>
              <Input type="number" placeholder="0,00" value={valorMax} onChange={e => setValorMax(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => {
                setTituloFilter(''); setUnidadeFilter('todos'); setNfSearch('');
                setDateFrom(''); setDateTo(''); setValorMin(''); setValorMax('');
              }}>Limpar filtros</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={8} rows={6} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 py-3 px-2">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every(o => selectedIds.has(o.id))}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(new Set(filtered.map(o => o.id)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Título</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Modo</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Comprador</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma ordem encontrada.</td></tr>
                  ) : filtered.map(o => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 text-center">
                        <Checkbox checked={selectedIds.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                      </td>
                      <td className="py-3 px-4 font-medium">{o.numero}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(o.created_at)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{o.titulo || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{o.unidade_setor || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{modoLabel(o.modo)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{o.comprador_nome || '—'}</td>
                      <td className="py-3 px-4 text-right currency font-medium">{formatCurrency(o.total)}</td>
                      <td className="py-3 px-4 text-center"><Badge className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</Badge></td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" onClick={() => viewOrder(o)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" title="PDF"><FileText className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => exportPDF(o)}>PDF Completo</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportPDFBySupplier(o)}>PDF por Fornecedor</DropdownMenuItem>
                              {['aprovado','emitido','recebido','recebido_com_ocorrencia'].includes(o.status) && o.has_requisition && (
                                <DropdownMenuItem onClick={() => exportPDF(o, true)}>PDF com saldo</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                          {(role === 'master' || role === 'aprovador') && o.status === 'aprovado' && (
                            <Button variant="ghost" size="icon" onClick={() => { setRejectTarget(o); setRejectReason(""); }} title="Reprovar">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {(role === 'master' || role === 'comprador' || role === 'estoquista') && (o.status === 'emitido' || o.status === 'recebido' || o.status === 'recebido_com_ocorrencia') && (
                            <Button variant="ghost" size="icon" onClick={() => { setCancelTarget(o); setCancelReason(""); }} title="Cancelar pedido">
                              <Ban className="h-4 w-4 text-destructive" />
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
              <label className="text-sm font-medium">Observação para o assistente de suprimentos</label>
              <Input placeholder="Ex: Entregar na portaria das 8h às 10h" value={previsaoObs} onChange={e => setPrevisaoObs(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPrevisaoTarget(null)}>Cancelar</Button>
              <Button onClick={handleSalvarPrevisao} disabled={savingPrevisao}>
                {savingPrevisao ? "Salvando..." : "Confirmar e notificar assistente"}
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
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancelar Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Pedido: <span className="font-medium text-foreground">{cancelTarget?.numero}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              O pedido será marcado como <strong>cancelado</strong> e removido da tela de Recebimentos.
              O comprador será notificado.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo do cancelamento *</label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: fornecedor cancelou, pedido duplicado, etc." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
              <Button variant="destructive" onClick={handleMasterCancel} disabled={cancelling}>
                {cancelling ? "Cancelando..." : "Cancelar pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reprovar Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Pedido: <span className="font-medium text-foreground">{rejectTarget?.numero}</span></div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da reprovação *</label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Informe o motivo..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleMasterReject} disabled={rejecting}>
                {rejecting ? "Reprovando..." : "Reprovar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isPrivileged && selectedOrders.length >= 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">{selectedOrders.length} pedido(s) selecionado(s)</span>
          <div className="h-5 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={exportSelectedPDF} disabled={exportingMulti}>
            <FileDown className="h-4 w-4 mr-2" />
            {exportingMulti ? 'Gerando...' : 'Exportar selecionados'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBatchReceiveOpen(true)} disabled={!canBatchReceive}
            title={!canBatchReceive ? 'Disponível apenas quando todos selecionados estão Aprovado ou Emitido' : ''}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Marcar como recebido
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBatchForecastOpen(true)} disabled={!canBatchForecast}
            title={!canBatchForecast ? 'Disponível apenas quando todos selecionados estão Emitido' : ''}>
            <Calendar className="h-4 w-4 mr-2" />
            Registrar previsão
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={batchReceiveOpen} onOpenChange={(o) => { if (!o) { setBatchReceiveOpen(false); setBatchReceiveDate(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Marcar {selectedOrders.length} pedido(s) como recebido</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de recebimento *</label>
              <Input type="date" value={batchReceiveDate} onChange={e => setBatchReceiveDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBatchReceiveOpen(false)}>Cancelar</Button>
              <Button onClick={handleBatchReceive} disabled={batchReceiving}>
                {batchReceiving ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchForecastOpen} onOpenChange={(o) => { if (!o) { setBatchForecastOpen(false); setBatchForecastDate(""); setBatchForecastObs(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar previsão em {selectedOrders.length} pedido(s)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data prevista de entrega *</label>
              <Input type="date" value={batchForecastDate} onChange={e => setBatchForecastDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Textarea value={batchForecastObs} onChange={e => setBatchForecastObs(e.target.value)} placeholder="Ex: Entregar na portaria das 8h às 10h" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBatchForecastOpen(false)}>Cancelar</Button>
              <Button onClick={handleBatchForecast} disabled={batchForecasting}>
                {batchForecasting ? "Salvando..." : "Confirmar e notificar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
