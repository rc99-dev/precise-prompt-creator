import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import OrderProductSearch from "@/components/order/OrderProductSearch";
import OrderItemRow from "@/components/order/OrderItemRow";
import OrderStickyFooter from "@/components/order/OrderStickyFooter";
import StrategyCards, { useStrategyAnalysis } from "@/components/order/StrategyCards";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type OrderItem = {
  product_id: string; product_name: string; unidade: string;
  quantidade: number; supplier_id: string; preco_unitario: number;
  subtotal: number; observacoes: string;
};

const fetchOrderData = async () => {
  const [{ data: p, error: e1 }, { data: s, error: e2 }, { data: pr, error: e3 }] = await Promise.all([
    supabase.from('products').select('id, nome, codigo_interno, unidade_medida').eq('status', 'ativo').order('nome'),
    supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario'),
  ]);
  if (e1 || e2 || e3) throw new Error("Erro ao carregar dados");
  return { products: (p || []) as Product[], suppliers: (s || []) as Supplier[], prices: (pr || []) as PriceEntry[] };
};

export default function NewOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<"melhor_preco" | "melhor_fornecedor" | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['order-base-data'],
    queryFn: fetchOrderData,
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];
  const suppliers = data?.suppliers || [];
  const allPrices = data?.prices || [];

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
    const { data: numData } = await supabase.rpc('generate_order_number');
    const numero = numData || `PED-${Date.now()}`;
    const modo = activeStrategy || 'manual';
    const { data: order, error: orderError } = await supabase.from('purchase_orders').insert({
      numero, user_id: user!.id, modo, status, observacoes, total,
    }).select().single();
    if (orderError) { toast.error(orderError.message); setSaving(false); return; }
    const orderItems = items.map(i => ({
      order_id: order.id, product_id: i.product_id, supplier_id: i.supplier_id || null,
      quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal,
      observacoes: i.observacoes || null,
    }));
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(orderItems);
    if (itemsError) { toast.error(itemsError.message); setSaving(false); return; }
    toast.success(status === 'rascunho' ? "Rascunho salvo!" : "Enviado para aprovação!");
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
        <h1 className="text-2xl font-bold">Nova Ordem de Compra</h1>
        <p className="text-muted-foreground text-sm mt-1">Monte seu pedido e escolha a melhor estratégia de compra</p>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

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
                    return (
                      <OrderItemRow key={item.product_id} item={item} index={idx}
                        isMinPrice={!!min && item.preco_unitario === min.preco}
                        availableSuppliers={getAvailableSuppliers(item.product_id)}
                        onUpdate={updateItem} onRemove={removeItem} />
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
