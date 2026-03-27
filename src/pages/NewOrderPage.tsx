import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";
import OrderProductSearch from "@/components/order/OrderProductSearch";
import OrderItemRow from "@/components/order/OrderItemRow";
import OrderStickyFooter from "@/components/order/OrderStickyFooter";

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type OrderItem = {
  product_id: string; product_name: string; unidade: string;
  quantidade: number; supplier_id: string; preco_unitario: number;
  subtotal: number; observacoes: string;
};

export default function NewOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allPrices, setAllPrices] = useState<PriceEntry[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [modo, setModo] = useState<'manual' | 'melhor_preco' | 'melhor_fornecedor'>('manual');
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [bestSingleSupplier, setBestSingleSupplier] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: p }, { data: s }, { data: pr }] = await Promise.all([
        supabase.from('products').select('id, nome, codigo_interno, unidade_medida').eq('status', 'ativo').order('nome'),
        supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
        supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario'),
      ]);
      setProducts(p || []);
      setSuppliers(s || []);
      setAllPrices(pr || []);
    };
    fetchData();
  }, []);

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
  }, [getSupplierPrice]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Apply modes
  useEffect(() => {
    if (modo === 'melhor_preco') {
      setItems(prev => prev.map(item => {
        const min = getMinPrice(item.product_id);
        if (!min) return item;
        return { ...item, supplier_id: min.supplier_id, preco_unitario: min.preco, subtotal: item.quantidade * min.preco };
      }));
    } else if (modo === 'melhor_fornecedor' && items.length > 0) {
      const supplierTotals: Record<string, number> = {};
      const supplierCoverage: Record<string, number> = {};
      suppliers.forEach(s => {
        let total = 0, covered = 0;
        items.forEach(item => {
          const price = getSupplierPrice(item.product_id, s.id);
          if (price > 0) { total += price * item.quantidade; covered++; }
        });
        if (covered > 0) { supplierTotals[s.id] = total; supplierCoverage[s.id] = covered; }
      });
      const maxCoverage = Math.max(...Object.values(supplierCoverage), 0);
      const candidates = Object.entries(supplierCoverage).filter(([, c]) => c === maxCoverage);
      const best = candidates.reduce((b, [id]) => supplierTotals[id] < supplierTotals[b] ? id : b, candidates[0]?.[0] || '');
      setBestSingleSupplier(best);
      if (best) {
        setItems(prev => prev.map(item => {
          const price = getSupplierPrice(item.product_id, best);
          return { ...item, supplier_id: best, preco_unitario: price, subtotal: item.quantidade * price };
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

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

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.razao_social || '—';

  const getAvailableSuppliers = useCallback((productId: string) => {
    const ids = (pricesByProduct[productId] || []).map(e => e.supplier_id);
    return suppliers.filter(s => ids.includes(s.id));
  }, [pricesByProduct, suppliers]);

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold">Nova Ordem de Compra</h1>
        <p className="text-muted-foreground text-sm mt-1">Monte seu pedido de compra</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={modo} onValueChange={(v: any) => setModo(v)}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Modo A — Manual</SelectItem>
            <SelectItem value="melhor_preco">Modo B — Melhor preço por item</SelectItem>
            <SelectItem value="melhor_fornecedor">Modo C — Melhor fornecedor único</SelectItem>
          </SelectContent>
        </Select>
        {modo === 'melhor_fornecedor' && bestSingleSupplier && (
          <Badge variant="default" className="text-xs">Fornecedor: {supplierName(bestSingleSupplier)}</Badge>
        )}
      </div>

      {/* Product search */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Adicionar Produtos</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <OrderProductSearch products={products} excludeIds={excludeIds} onAdd={addProduct} />
        </CardContent>
      </Card>

      {/* Items table */}
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
                      <OrderItemRow
                        key={item.product_id}
                        item={item}
                        index={idx}
                        isMinPrice={!!min && item.preco_unitario === min.preco}
                        availableSuppliers={getAvailableSuppliers(item.product_id)}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observations */}
      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-base">Observações Gerais</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Textarea placeholder="Observações sobre o pedido..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <OrderStickyFooter
        total={total}
        economy={economy}
        itemCount={items.length}
        saving={saving}
        onSaveDraft={() => handleSave('rascunho')}
        onSubmit={() => handleSave('aguardando_aprovacao')}
      />
    </div>
  );
}
