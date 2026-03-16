import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, TrendingDown, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

type Product = { id: string; nome: string; unidade_medida: string; codigo_interno: string | null };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type CompItem = { product_id: string; product_name: string; unidade: string; quantidade: number };

export default function ComparativePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [items, setItems] = useState<CompItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: p }, { data: s }, { data: pr }] = await Promise.all([
        supabase.from('products').select('id, nome, unidade_medida, codigo_interno').eq('status', 'ativo').order('nome'),
        supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
        supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario'),
      ]);
      setProducts(p || []); setSuppliers(s || []); setPrices(pr || []);
    };
    fetchData();
  }, []);

  const getPrice = (productId: string, supplierId: string) =>
    prices.find(p => p.product_id === productId && p.supplier_id === supplierId)?.preco_unitario;

  const getMinPrice = (productId: string) => {
    const ps = prices.filter(p => p.product_id === productId);
    return ps.length > 0 ? Math.min(...ps.map(p => p.preco_unitario)) : null;
  };

  const filteredProducts = products.filter(p =>
    !items.find(i => i.product_id === p.id) &&
    (p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (p.codigo_interno || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addProduct = (p: Product) => {
    setItems([...items, { product_id: p.id, product_name: p.nome, unidade: p.unidade_medida, quantidade: 1 }]);
    setSearchTerm("");
  };

  const updateQty = (idx: number, qty: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantidade: qty } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Relevant suppliers = those with at least one price for any item
  const relevantSuppliers = useMemo(() => {
    const ids = new Set(prices.filter(p => items.some(i => i.product_id === p.product_id)).map(p => p.supplier_id));
    return suppliers.filter(s => ids.has(s.id));
  }, [suppliers, prices, items]);

  // Totals
  const supplierTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    relevantSuppliers.forEach(s => {
      let total = 0;
      items.forEach(item => {
        const price = getPrice(item.product_id, s.id);
        if (price) total += price * item.quantidade;
      });
      totals[s.id] = total;
    });
    return totals;
  }, [relevantSuppliers, items, prices]);

  const bestPerItemTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const min = getMinPrice(item.product_id);
      return sum + (min ? min * item.quantidade : 0);
    }, 0);
  }, [items, prices]);

  const bestSingleSupplier = useMemo(() => {
    if (relevantSuppliers.length === 0) return null;
    // Best = covers most items, then lowest total
    let best = { id: '', total: Infinity, coverage: 0 };
    relevantSuppliers.forEach(s => {
      let total = 0; let coverage = 0;
      items.forEach(item => {
        const price = getPrice(item.product_id, s.id);
        if (price) { total += price * item.quantidade; coverage++; }
      });
      if (coverage > best.coverage || (coverage === best.coverage && total < best.total)) {
        best = { id: s.id, total, coverage };
      }
    });
    return best.id ? best : null;
  }, [relevantSuppliers, items, prices]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comparativo de Cotação</h1>
        <p className="text-muted-foreground text-sm mt-1">Compare preços entre fornecedores</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Adicionar Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {searchTerm && filteredProducts.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 10).map(p => (
                <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-muted/50 flex items-center justify-between text-sm border-b last:border-0" onClick={() => addProduct(p)}>
                  <span className="font-medium">{p.nome}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-card">Produto</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-20">Qtd</th>
                    {relevantSuppliers.map(s => (
                      <th key={s.id} className="text-right py-3 px-4 font-medium text-muted-foreground min-w-[140px]">{s.razao_social}</th>
                    ))}
                    <th className="text-right py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const minPrice = getMinPrice(item.product_id);
                    const hasAnyPrice = prices.some(p => p.product_id === item.product_id);
                    return (
                      <tr key={item.product_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4 sticky left-0 bg-card">
                          <span className="font-medium">{item.product_name}</span>
                          {!hasAnyPrice && (
                            <span className="flex items-center gap-1 text-warning text-xs mt-1">
                              <AlertTriangle className="h-3 w-3" />Sem preço cadastrado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Input type="number" min="0.01" step="0.01" className="w-16 text-center mx-auto" value={item.quantidade} onChange={e => updateQty(idx, parseFloat(e.target.value) || 0)} />
                        </td>
                        {relevantSuppliers.map(s => {
                          const price = getPrice(item.product_id, s.id);
                          const isMin = price !== undefined && price === minPrice;
                          return (
                            <td key={s.id} className={`py-3 px-4 text-right currency ${isMin ? 'text-success font-bold' : 'text-muted-foreground'}`}>
                              {price !== undefined ? (
                                <span>{isMin && <TrendingDown className="h-3 w-3 inline mr-1" />}{formatCurrency(price)}</span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">Sem preço</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-3 px-4 sticky left-0 bg-card">Total por fornecedor</td>
                    <td></td>
                    {relevantSuppliers.map(s => (
                      <td key={s.id} className="py-3 px-4 text-right currency">
                        {formatCurrency(supplierTotals[s.id] || 0)}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Melhor Preço por Item</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold currency">{formatCurrency(bestPerItemTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">Pode dividir entre vários fornecedores</p>
              </CardContent>
            </Card>
            {bestSingleSupplier && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Melhor Fornecedor Único</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold currency">{formatCurrency(bestSingleSupplier.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{suppliers.find(s => s.id === bestSingleSupplier.id)?.razao_social} ({bestSingleSupplier.coverage}/{items.length} itens)</p>
                </CardContent>
              </Card>
            )}
            {bestSingleSupplier && bestSingleSupplier.total > bestPerItemTotal && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Diferença</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold currency text-warning">{formatCurrency(bestSingleSupplier.total - bestPerItemTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Economia ao dividir entre fornecedores</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
