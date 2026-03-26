import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Trash2, Save, TrendingDown, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { id: string; supplier_id: string; product_id: string; preco_unitario: number };
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
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [bestSingleSupplier, setBestSingleSupplier] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: p }, { data: s }, { data: pr }] = await Promise.all([
        supabase.from('products').select('id, nome, codigo_interno, unidade_medida').eq('status', 'ativo').order('nome'),
        supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
        supabase.from('supplier_prices').select('id, supplier_id, product_id, preco_unitario'),
      ]);
      setProducts(p || []);
      setSuppliers(s || []);
      setAllPrices(pr || []);
    };
    fetchData();
  }, []);

  // Prices lookup: product_id -> [{ supplier_id, preco }]
  const pricesByProduct = useMemo(() => {
    const map: Record<string, { supplier_id: string; preco: number }[]> = {};
    allPrices.forEach(p => {
      if (!map[p.product_id]) map[p.product_id] = [];
      map[p.product_id].push({ supplier_id: p.supplier_id, preco: p.preco_unitario });
    });
    return map;
  }, [allPrices]);

  const getMinPrice = (productId: string) => {
    const entries = pricesByProduct[productId] || [];
    if (entries.length === 0) return null;
    return entries.reduce((min, e) => e.preco < min.preco ? e : min, entries[0]);
  };

  const getSupplierPrice = (productId: string, supplierId: string) => {
    return allPrices.find(p => p.product_id === productId && p.supplier_id === supplierId)?.preco_unitario || 0;
  };

  const filteredProducts = products.filter(p =>
    !items.find(i => i.product_id === p.id) &&
    (p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (p.codigo_interno || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addProduct = (product: Product) => {
    const min = getMinPrice(product.id);
    const item: OrderItem = {
      product_id: product.id,
      product_name: product.nome,
      unidade: product.unidade_medida,
      quantidade: 1,
      supplier_id: min?.supplier_id || '',
      preco_unitario: min?.preco || 0,
      subtotal: min?.preco || 0,
      observacoes: '',
    };
    setItems([...items, item]);
    setSearchTerm("");
  };

  const updateItem = (index: number, updates: Partial<OrderItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...updates };
      if ('supplier_id' in updates && updates.supplier_id) {
        updated.preco_unitario = getSupplierPrice(item.product_id, updates.supplier_id);
      }
      updated.subtotal = updated.quantidade * updated.preco_unitario;
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Apply modes
  useEffect(() => {
    if (modo === 'melhor_preco') {
      setItems(prev => prev.map(item => {
        const min = getMinPrice(item.product_id);
        if (!min) return item;
        return { ...item, supplier_id: min.supplier_id, preco_unitario: min.preco, subtotal: item.quantidade * min.preco };
      }));
    } else if (modo === 'melhor_fornecedor' && items.length > 0) {
      // Find supplier with lowest total for all items
      const supplierTotals: Record<string, number> = {};
      const supplierCoverage: Record<string, number> = {};
      suppliers.forEach(s => {
        let total = 0;
        let covered = 0;
        items.forEach(item => {
          const price = getSupplierPrice(item.product_id, s.id);
          if (price > 0) { total += price * item.quantidade; covered++; }
        });
        if (covered > 0) {
          supplierTotals[s.id] = total;
          supplierCoverage[s.id] = covered;
        }
      });
      // Best = supplier covering most items with lowest total among max coverage
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
  }, [modo]);

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  // Calculate economy vs max prices
  const totalMaxPrice = items.reduce((sum, item) => {
    const entries = pricesByProduct[item.product_id] || [];
    const max = entries.length > 0 ? Math.max(...entries.map(e => e.preco)) : item.preco_unitario;
    return sum + max * item.quantidade;
  }, 0);
  const economy = totalMaxPrice - total;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nova Ordem de Compra</h1>
          <p className="text-muted-foreground text-sm mt-1">Monte seu pedido de compra</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('rascunho')} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave('aguardando_aprovacao')} disabled={saving}>
            <ShoppingCart className="h-4 w-4 mr-2" />Enviar para Aprovação
          </Button>
        </div>
      </div>

      {/* Total bar */}
      {items.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="text-2xl font-bold currency">{formatCurrency(total)}</p>
              </div>
              {economy > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Economia estimada</p>
                  <p className="text-lg font-semibold text-success currency flex items-center gap-1">
                    <TrendingDown className="h-4 w-4" />{formatCurrency(economy)}
                  </p>
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-sm">{items.length} {items.length === 1 ? 'item' : 'itens'}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Mode selector */}
      <div className="flex gap-3 flex-wrap">
        <Select value={modo} onValueChange={(v: any) => setModo(v)}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Modo A — Manual</SelectItem>
            <SelectItem value="melhor_preco">Modo B — Melhor preço por item</SelectItem>
            <SelectItem value="melhor_fornecedor">Modo C — Melhor fornecedor único</SelectItem>
          </SelectContent>
        </Select>
        {modo === 'melhor_fornecedor' && bestSingleSupplier && (
          <Badge variant="default" className="text-sm">Fornecedor: {supplierName(bestSingleSupplier)}</Badge>
        )}
      </div>

      {/* Product search */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Adicionar Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto por nome ou código..." className="pl-9"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {searchTerm && filteredProducts.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 10).map(p => (
                <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-muted/50 flex items-center justify-between text-sm border-b last:border-0"
                  onClick={() => addProduct(p)}>
                  <span><span className="font-medium">{p.nome}</span> {p.codigo_interno && <span className="text-muted-foreground ml-2">({p.codigo_interno})</span>}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          {searchTerm && filteredProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum produto encontrado.</p>
          )}
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-24">Qtd</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Preço Unit.</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Subtotal</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const min = getMinPrice(item.product_id);
                    const isMin = min && item.preco_unitario === min.preco;
                    const availableSuppliers = (pricesByProduct[item.product_id] || []).map(e => e.supplier_id);
                    return (
                      <tr key={item.product_id} className={`border-b last:border-0 ${isMin ? 'bg-success/5' : ''}`}>
                        <td className="py-3 px-4">
                          <span className="font-medium">{item.product_name}</span>
                          <span className="text-muted-foreground ml-1 text-xs">({item.unidade})</span>
                        </td>
                        <td className="py-3 px-4">
                          <Input type="number" min="0.01" step="0.01" className="w-20 text-center mx-auto"
                            value={item.quantidade} onChange={e => updateItem(idx, { quantidade: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td className="py-3 px-4">
                          <Select value={item.supplier_id} onValueChange={v => updateItem(idx, { supplier_id: v })}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {suppliers.filter(s => availableSuppliers.includes(s.id)).map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4 text-right currency font-medium">
                          {isMin && <TrendingDown className="h-3 w-3 inline mr-1 text-success" />}
                          {formatCurrency(item.preco_unitario)}
                        </td>
                        <td className="py-3 px-4 text-right currency font-bold">{formatCurrency(item.subtotal)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={4} className="py-3 px-4 text-right font-bold">Total:</td>
                    <td className="py-3 px-4 text-right currency font-bold text-lg">{formatCurrency(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observations */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Observações Gerais</CardTitle></CardHeader>
        <CardContent>
          <Textarea placeholder="Observações sobre o pedido..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </CardContent>
      </Card>
    </div>
  );
}
