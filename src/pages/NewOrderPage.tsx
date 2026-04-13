import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UNIDADES } from "@/lib/constants";
import OrderProductSearch from "@/components/order/OrderProductSearch";
import OrderItemRow from "@/components/order/OrderItemRow";
import OrderStickyFooter from "@/components/order/OrderStickyFooter";
import StrategyCards, { useStrategyAnalysis } from "@/components/order/StrategyCards";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";
import { useOrderDraft, DraftOrderItem } from "@/hooks/useOrderDraft";
import { AlertTriangle, Trash2, RotateCcw, ClipboardList } from "lucide-react";

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type SaldoMap = Record<string, number>;
type OrderItem = DraftOrderItem;

const fetchOrderData = async () => {
 const [{ data: p, error: e1 }, { data: s, error: e2 }, { data: reqs }] = await Promise.all([
    supabase.from('products').select('id, nome, unidade_medida, codigo_interno').eq('status', 'ativo').order('nome'),
    supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
    supabase.from('requisitions').select('product_id, saldo_atual').eq('status', 'pendente'),
  ]);
  if (e1 || e2) throw new Error("Erro ao carregar dados");

  const [{ data: pr1 }, { data: pr2 }] = await Promise.all([
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario').range(0, 999),
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario').range(1000, 1999),
  ]);

  const prices = [...(pr1 || []), ...(pr2 || [])];

  // Aggregate saldos by product
  const saldos: SaldoMap = {};
  (reqs || []).forEach((r: any) => {
    saldos[r.product_id] = (saldos[r.product_id] || 0) + r.saldo_atual;
  });

  return { products: (p || []) as Product[], suppliers: (s || []) as Supplier[], prices: prices as PriceEntry[], saldos };
};

export default function NewOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get("edit");
  const requisitionId = searchParams.get("requisition");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<"melhor_preco" | "melhor_fornecedor" | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [unidadeSolicitante, setUnidadeSolicitante] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [selectedReqImport, setSelectedReqImport] = useState<string | null>(null);
  const draftRestored = useRef(false);
  const { hasDraft, saveDraft, loadDraft, clearDraft } = useOrderDraft();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['order-base-data-v3'],
    queryFn: fetchOrderData,
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];
  const suppliers = data?.suppliers || [];
  const allPrices = data?.prices || [];
  const saldos = data?.saldos || {};

  useEffect(() => {
    if (!data || draftRestored.current) return;
    draftRestored.current = true;

    if (editOrderId) {
      (async () => {
        const { data: orderItems } = await supabase
          .from('purchase_order_items')
          .select('*, products(nome, unidade_medida)')
          .eq('order_id', editOrderId);
        const { data: order } = await supabase
          .from('purchase_orders')
          .select('observacoes, modo, unidade_setor')
          .eq('id', editOrderId)
          .single();
        if (orderItems && orderItems.length > 0) {
          setItems(orderItems.map(i => ({
            product_id: i.product_id,
            product_name: (i.products as any)?.nome || '',
            unidade: (i.products as any)?.unidade_medida || '',
            quantidade: i.quantidade,
            supplier_id: i.supplier_id || '',
            preco_unitario: i.preco_unitario,
            subtotal: i.subtotal,
            observacoes: i.observacoes || '',
          })));
          if (order?.observacoes) setObservacoes(order.observacoes);
          if (order?.unidade_setor) setUnidadeSolicitante(order.unidade_setor);
          if (order?.modo === 'melhor_preco' || order?.modo === 'melhor_fornecedor') {
            setActiveStrategy(order.modo as any);
          }
        }
      })();
      return;
    }

    // Load from requisition param — import ALL items
    if (requisitionId) {
      (async () => {
        // Get the requisition header for unidade info
        const { data: req } = await supabase
          .from('requisitions')
          .select('id, unidade, unidade_setor, observacoes')
          .eq('id', requisitionId)
          .single();
        // Get all requisition_items for this requisition
        const { data: reqItems } = await supabase
          .from('requisition_items')
          .select('product_id, saldo, products(nome, unidade_medida)')
          .eq('requisition_id', requisitionId);
        if (req && reqItems && reqItems.length > 0) {
          const newItems: OrderItem[] = reqItems.map((ri: any) => {
            const productName = ri.products?.nome || '';
            const unidade = ri.products?.unidade_medida || '';
            const pricesForProduct = allPrices.filter(p => p.product_id === ri.product_id);
            const min = pricesForProduct.length > 0
              ? pricesForProduct.reduce((m, e) => e.preco_unitario < m.preco_unitario ? e : m, pricesForProduct[0])
              : null;
            const qty = ri.saldo || 1;
            return {
              product_id: ri.product_id,
              product_name: productName,
              unidade,
              quantidade: qty,
              supplier_id: min?.supplier_id || '',
              preco_unitario: min?.preco_unitario || 0,
              subtotal: qty * (min?.preco_unitario || 0),
              observacoes: '',
            };
          });
          setItems(newItems);
          if (req.unidade) setUnidadeSolicitante(req.unidade);
          else if (req.unidade_setor) setUnidadeSolicitante(req.unidade_setor);
        }
      })();
      return;
    }

    const draft = loadDraft();
    if (draft && draft.items.length > 0) {
      setShowDraftBanner(true);
    }
  }, [data, editOrderId, requisitionId, loadDraft, allPrices]);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setItems(draft.items);
      setObservacoes(draft.observacoes);
      setActiveStrategy(draft.activeStrategy);
      setShowDraftBanner(false);
      toast.success("Rascunho restaurado!");
    }
  }, [loadDraft]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setShowDraftBanner(false);
    toast.info("Rascunho descartado.");
  }, [clearDraft]);

  useEffect(() => {
    if (editOrderId || requisitionId || !draftRestored.current) return;
    saveDraft({ items, observacoes, activeStrategy, editingOrderId: null });
  }, [items, observacoes, activeStrategy, saveDraft, editOrderId, requisitionId]);

  const pricesByProduct = useMemo(() => {
    const map: Record<string, { supplier_id: string; preco: number }[]> = {};
    allPrices.forEach(p => {
      if (!map[p.product_id]) map[p.product_id] = [];
      map[p.product_id].push({ supplier_id: p.supplier_id, preco: p.preco_unitario });
    });
    return map;
  }, [allPrices]);

  const getMinPrice = useCallback((productId: string) => {
    const entries = pricesByProduct[productId] || [];
    if (entries.length === 0) return null;
    return entries.reduce((min, e) => e.preco < min.preco ? e : min, entries[0]);
  }, [pricesByProduct]);

  const getSupplierPrice = useCallback((productId: string, supplierId: string) => {
    return allPrices.find(p => p.product_id === productId && p.supplier_id === supplierId)?.preco_unitario || 0;
  }, [allPrices]);

  const excludeIds = useMemo(() => new Set(items.map(i => i.product_id)), [items]);

  const addProduct = useCallback((product: Product) => {
    const min = getMinPrice(product.id);
    setItems(prev => [...prev, {
      product_id: product.id, product_name: product.nome, unidade: product.unidade_medida,
      quantidade: 1, supplier_id: min?.supplier_id || '', preco_unitario: min?.preco || 0,
      subtotal: min?.preco || 0, observacoes: '',
    }]);
  }, [getMinPrice]);

  const updateItem = useCallback((index: number, updates: Partial<OrderItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...updates };
      if ('supplier_id' in updates && updates.supplier_id) {
        updated.preco_unitario = getSupplierPrice(item.product_id, updates.supplier_id);
      }
      updated.subtotal = updated.quantidade * updated.preco_unitario;
      return updated;
    }));
    setActiveStrategy(null);
  }, [getSupplierPrice]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const analysis = useStrategyAnalysis(items, allPrices, suppliers);

  const applyStrategy = useCallback((strategy: "melhor_preco" | "melhor_fornecedor") => {
    setActiveStrategy(strategy);
    if (strategy === "melhor_preco") {
      setItems(prev => prev.map(item => {
        const min = getMinPrice(item.product_id);
        if (!min) return item;
        return { ...item, supplier_id: min.supplier_id, preco_unitario: min.preco, subtotal: item.quantidade * min.preco };
      }));
    } else if (strategy === "melhor_fornecedor" && analysis?.bestSingle) {
      const bestId = analysis.bestSingle.supplierId;
      setItems(prev => prev.map(item => {
        const price = getSupplierPrice(item.product_id, bestId);
        return { ...item, supplier_id: bestId, preco_unitario: price, subtotal: item.quantidade * price };
      }));
    }
  }, [getMinPrice, getSupplierPrice, analysis]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.subtotal, 0), [items]);

  const economy = useMemo(() => {
    const totalMax = items.reduce((sum, item) => {
      const entries = pricesByProduct[item.product_id] || [];
      const max = entries.length > 0 ? Math.max(...entries.map(e => e.preco)) : item.preco_unitario;
      return sum + max * item.quantidade;
    }, 0);
    return totalMax - total;
  }, [items, pricesByProduct, total]);

  const handleSave = async (status: 'rascunho' | 'aguardando_aprovacao') => {
    if (items.length === 0) { toast.error("Adicione pelo menos um item."); return; }
    setSaving(true);

    if (editOrderId) {
      const modo = activeStrategy || 'manual';
      const { error: updateErr } = await supabase.from('purchase_orders').update({
        modo, status, observacoes, total, unidade_setor: unidadeSolicitante || null,
      }).eq('id', editOrderId);
      if (updateErr) { toast.error(updateErr.message); setSaving(false); return; }

      await supabase.from('purchase_order_items').delete().eq('order_id', editOrderId);
      const orderItems = items.map(i => ({
        order_id: editOrderId, product_id: i.product_id, supplier_id: i.supplier_id || null,
        quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
        observacoes: i.observacoes || null,
      }));
      const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItems);
      if (itemsError) { toast.error(itemsError.message); setSaving(false); return; }
      toast.success(status === 'rascunho' ? "Rascunho atualizado!" : "Enviado para aprovação!");
    } else {
      const { data: numData } = await supabase.rpc('generate_order_number');
      const numero = numData || `PED-${Date.now()}`;
      const modo = activeStrategy || 'manual';
      const { data: order, error: orderError } = await supabase.from('purchase_orders').insert({
        numero, user_id: user!.id, modo, status, observacoes, total,
        unidade_setor: unidadeSolicitante || null,
      }).select().single();
      if (orderError) { toast.error(orderError.message); setSaving(false); return; }
      const orderItems = items.map(i => ({
        order_id: order.id, product_id: i.product_id, supplier_id: i.supplier_id || null,
        quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
        observacoes: i.observacoes || null,
      }));
      const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItems);
      if (itemsError) { toast.error(itemsError.message); setSaving(false); return; }

      // Update requisition status if came from requisition
      if (requisitionId) {
        await supabase.from('requisitions').update({
          status: 'incluida_no_pedido', order_id: order.id,
        } as any).eq('id', requisitionId);
      }

      toast.success(status === 'rascunho' ? "Rascunho salvo!" : "Enviado para aprovação!");
    }

    clearDraft();
    setSaving(false);
    navigate('/historico');
  };

  const getAvailableSuppliers = useCallback((productId: string) => {
    const ids = (pricesByProduct[productId] || []).map(e => e.supplier_id);
    return suppliers.filter(s => ids.includes(s.id));
  }, [pricesByProduct, suppliers]);

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold">{editOrderId ? "Editar Ordem de Compra" : "Nova Ordem de Compra"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {editOrderId ? "Edite os itens e salve ou envie para aprovação" : "Monte seu pedido e escolha a melhor estratégia de compra"}
        </p>
      </div>

      {showDraftBanner && !editOrderId && !requisitionId && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-medium">Você tem uma ordem em andamento.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={discardDraft}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Descartar
              </Button>
              <Button size="sm" onClick={restoreDraft}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isError && <QueryError onRetry={() => refetch()} />}

      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Unidade Solicitante</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Select value={unidadeSolicitante} onValueChange={setUnidadeSolicitante}>
            <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
            <SelectContent>
              {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-base">Adicionar Produtos</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {isLoading ? <TableSkeleton columns={2} rows={3} /> : (
            <OrderProductSearch products={products} excludeIds={excludeIds} onAdd={addProduct} />
          )}
        </CardContent>
      </Card>

      {items.length > 0 && analysis && (
        <StrategyCards analysis={analysis} selectedStrategy={activeStrategy} onSelect={applyStrategy} showSelectButton />
      )}

      {items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Produto</th>
                    <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs w-16">Saldo</th>
                    <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs w-24">Qtd</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Fornecedor</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Preço Unit.</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const min = getMinPrice(item.product_id);
                    const saldo = saldos[item.product_id] || 0;
                    return (
                      <OrderItemRow key={item.product_id} item={item} index={idx}
                        isMinPrice={!!min && item.preco_unitario === min.preco}
                        availableSuppliers={getAvailableSuppliers(item.product_id)}
                        onUpdate={updateItem} onRemove={removeItem}
                        saldo={saldo} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-base">Observações Gerais</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Textarea placeholder="Observações sobre o pedido..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
        </CardContent>
      </Card>

      <OrderStickyFooter total={total} economy={economy} itemCount={items.length} saving={saving}
        onSaveDraft={() => handleSave('rascunho')} onSubmit={() => handleSave('aguardando_aprovacao')} />
    </div>
  );
}