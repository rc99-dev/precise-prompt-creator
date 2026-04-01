import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2, TrendingDown, AlertTriangle, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { generateQuotationPDF } from "@/lib/pdfGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import StrategyCards, { useStrategyAnalysis } from "@/components/order/StrategyCards";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type Product = { id: string; nome: string; unidade_medida: string; codigo_interno: string | null };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type CompItem = { product_id: string; product_name: string; unidade: string; quantidade: number };

const fetchCompData = async () => {
  const [{ data: p, error: e1 }, { data: s, error: e2 }, { data: pr, error: e3 }] = await Promise.all([
    supabase.from('products').select('id, nome, unidade_medida, codigo_interno').eq('status', 'ativo').order('nome'),
    supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario').limit(3000),
  ]);
  if (e1 || e2 || e3) throw new Error("Erro ao carregar dados");
  return { products: (p || []) as Product[], suppliers: (s || []) as Supplier[], prices: (pr || []) as PriceEntry[] };
};

export default function ComparativePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['comparative-base-data-v3'],
    queryFn: fetchCompData,
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];
  const suppliers = data?.suppliers || [];
  const prices = data?.prices || [];

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

  const relevantSuppliers = useMemo(() => {
    const ids = new Set(prices.filter(p => items.some(i => i.product_id === p.product_id)).map(p => p.supplier_id));
    return suppliers.filter(s => ids.has(s.id));
  }, [suppliers, prices, items]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantSuppliers, items, prices]);

  const analysis = useStrategyAnalysis(items, prices, suppliers);

  const exportQuotPDF = async () => {
    if (items.length === 0) return;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).single();
    generateQuotationPDF({
      numero: `COT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      created_at: new Date().toISOString(),
      estrategia: analysis?.recommendedStrategy || "melhor_preco",
      total: analysis?.bestPerItem.total || 0,
      items: items.map(item => ({
        product_name: item.product_name, unidade: item.unidade, quantidade: item.quantidade,
        prices: Object.fromEntries(relevantSuppliers.map(s => [s.id, getPrice(item.product_id, s.id) ?? null])),
      })),
      suppliers: relevantSuppliers, supplierTotals,
      bestSupplierId: analysis?.bestSingle?.supplierId,
      comprador: profile?.full_name,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comparativo de Cotação</h1>
          <p className="text-muted-foreground text-sm mt-1">Compare preços entre fornecedores e escolha a melhor estratégia</p>
        </div>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportQuotPDF}>
            <FileText className="h-4 w-4 mr-1.5" />Exportar PDF
          </Button>
        )}
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      <Card>
        <CardHeader><CardTitle className="text-lg">Adicionar Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <TableSkeleton columns={2} rows={3} /> : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <>
          {analysis && <StrategyCards analysis={analysis} />}
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
                            <td key={s.id} className={`py-3 px-4 text-right ${isMin ? 'text-success font-bold' : 'text-muted-foreground'}`}>
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
                    {relevantSuppliers.map(s => {
                      const isLowest = analysis?.bestSingle?.supplierId === s.id;
                      return (
                        <td key={s.id} className={`py-3 px-4 text-right ${isLowest ? 'text-success' : ''}`}>
                          {formatCurrency(supplierTotals[s.id] || 0)}
                          {isLowest && <TrendingDown className="h-3 w-3 inline ml-1" />}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
