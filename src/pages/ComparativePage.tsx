import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, TrendingDown, AlertTriangle, FileText, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { generateQuotationPDF } from "@/lib/pdfGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { UNIDADES } from "@/lib/constants";
import StrategyCards, { useStrategyAnalysis } from "@/components/order/StrategyCards";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";
import { useComparativeDraft, DraftCompItem } from "@/hooks/useComparativeDraft";

type Product = { id: string; nome: string; unidade_medida: string; codigo_interno: string | null };
type Supplier = { id: string; razao_social: string };
type PriceEntry = { supplier_id: string; product_id: string; preco_unitario: number };
type CompItem = DraftCompItem;

type RequisitionOption = {
  id: string; product_id: string; saldo_atual: number; unidade_medida: string;
  unidade: string | null; setor: string | null; unidade_setor: string | null;
  titulo: string | null;
  user_id: string; created_at: string;
  products?: { nome: string } | null;
  profiles?: { full_name: string } | null;
};

const fetchCompData = async () => {
  const [{ data: p, error: e1 }, { data: s, error: e2 }] = await Promise.all([
    supabase.from('products').select('id, nome, unidade_medida, codigo_interno').eq('status', 'ativo').order('nome'),
    supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
  ]);
  if (e1 || e2) throw new Error("Erro ao carregar dados");

  const [{ data: pr1 }, { data: pr2 }] = await Promise.all([
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario').range(0, 999),
    supabase.from('supplier_prices').select('supplier_id, product_id, preco_unitario').range(1000, 1999),
  ]);

  const prices = [...(pr1 || []), ...(pr2 || [])];
  return { products: (p || []) as Product[], suppliers: (s || []) as Supplier[], prices: prices as PriceEntry[] };
};

export default function ComparativePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [unidadeSolicitante, setUnidadeSolicitante] = useState("");
  const [showSaldo, setShowSaldo] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [reqInfo, setReqInfo] = useState<{ solicitante: string; unidade: string; setor: string } | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftRestored = useRef(false);
  const { hasDraft, saveDraft, loadDraft, clearDraft } = useComparativeDraft();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['comparative-base-data-v3'],
    queryFn: fetchCompData,
    staleTime: 5 * 60 * 1000,
  });

  // Filter requisitions by selected unidade
  const { data: pendingReqs = [] } = useQuery({
    queryKey: ['pending-requisitions-for-comp', unidadeSolicitante],
    queryFn: async () => {
      let query = supabase
        .from('requisitions')
        .select('id, product_id, saldo_atual, unidade_medida, unidade, setor, unidade_setor, user_id, created_at, titulo, products(nome)')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      
      if (unidadeSolicitante) {
        query = query.eq('unidade', unidadeSolicitante);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Group by unique requisition (titulo + user_id + created_at combo as proxy for "same requisition")
      // Since requisitions table has one row per product, we group by titulo+unidade+created_at
      return (data || []) as unknown as RequisitionOption[];
    },
    staleTime: 30 * 1000,
    enabled: showSaldo,
  });

  const products = data?.products || [];
  const suppliers = data?.suppliers || [];
  const prices = data?.prices || [];

  // Draft restore
  useEffect(() => {
    if (!data || draftRestored.current) return;
    draftRestored.current = true;
    const draft = loadDraft();
    if (draft && draft.items.length > 0) {
      setShowDraftBanner(true);
    }
  }, [data, loadDraft]);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setItems(draft.items);
      setUnidadeSolicitante(draft.unidadeSolicitante || "");
      setShowSaldo(draft.showSaldo);
      setSelectedReqId(draft.selectedRequisitionId);
      setShowDraftBanner(false);
    }
  }, [loadDraft]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setShowDraftBanner(false);
  }, [clearDraft]);

  // Auto-save draft
  useEffect(() => {
    if (!draftRestored.current) return;
    saveDraft({ items, unidadeSolicitante, showSaldo, selectedRequisitionId: selectedReqId });
  }, [items, unidadeSolicitante, showSaldo, selectedReqId, saveDraft]);

  // Load requisition products
  useEffect(() => {
    if (!selectedReqId || !showSaldo) return;
    const reqs = pendingReqs.filter(r => r.id === selectedReqId || selectedReqId === 'all');
    // If single req selected, get user info
    if (selectedReqId !== 'all' && reqs.length > 0) {
      const req = reqs[0];
      supabase.from('profiles').select('full_name').eq('user_id', req.user_id).single()
        .then(({ data: profile }) => {
          setReqInfo({
            solicitante: profile?.full_name || '—',
            unidade: (req as any).unidade || req.unidade_setor || '—',
            setor: (req as any).setor || '—',
          });
        });
    }
    // Pre-load products
    const newItems: CompItem[] = reqs.map(r => ({
      product_id: r.product_id,
      product_name: r.products?.nome || '—',
      unidade: r.unidade_medida,
      quantidade: 1,
      saldo: r.saldo_atual,
    }));
    // Merge with existing, avoiding duplicates
    setItems(prev => {
      const existingIds = new Set(prev.map(i => i.product_id));
      const toAdd = newItems.filter(i => !existingIds.has(i.product_id));
      const updated = prev.map(p => {
        const match = newItems.find(n => n.product_id === p.product_id);
        return match ? { ...p, saldo: match.saldo } : p;
      });
      return [...updated, ...toAdd];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReqId, showSaldo, pendingReqs]);

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
        saldo: item.saldo,
      })),
      suppliers: relevantSuppliers, supplierTotals,
      bestSupplierId: analysis?.bestSingle?.supplierId,
      comprador: profile?.full_name,
      unidadeSolicitante: unidadeSolicitante || undefined,
      showSaldo,
      requisitionInfo: showSaldo && reqInfo ? {
        solicitante: reqInfo.solicitante,
        unidade: reqInfo.unidade,
        setor: reqInfo.setor,
      } : undefined,
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

      {showDraftBanner && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-medium">Você tem uma cotação em andamento.</span>
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

      {/* Unidade + Solicitação controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Unidade Solicitante</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <Select value={unidadeSolicitante} onValueChange={(v) => {
              setUnidadeSolicitante(v);
              // Reset requisition selection when unidade changes
              setSelectedReqId(null);
              setReqInfo(null);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Solicitação</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Mostrar saldo</Label>
                <Switch checked={showSaldo} onCheckedChange={setShowSaldo} />
              </div>
            </div>
          </CardHeader>
          {showSaldo && (
            <CardContent className="px-4 pb-3 pt-0">
              <Select value={selectedReqId || ''} onValueChange={v => setSelectedReqId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione a solicitação" /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    // Group requisitions by titulo to show one entry per solicitação
                    const seen = new Map<string, RequisitionOption>();
                    pendingReqs.forEach(r => {
                      const key = `${r.titulo || ''}|${r.unidade || ''}|${r.created_at}`;
                      if (!seen.has(key)) seen.set(key, r);
                    });
                    return Array.from(seen.values()).map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.titulo || r.products?.nome || '—'} — {r.unidade || '—'} — {new Date(r.created_at).toLocaleDateString('pt-BR')}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </CardContent>
          )}
        </Card>
      </div>

      {showSaldo && reqInfo && selectedReqId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 text-sm">
            <span className="font-medium">Cotação referente à solicitação</span>
            {" — "}Solicitante: <span className="font-medium">{reqInfo.solicitante}</span>
            {" — "}Unidade: <span className="font-medium">{reqInfo.unidade}</span>
            {" — "}Setor: <span className="font-medium">{reqInfo.setor}</span>
          </CardContent>
        </Card>
      )}

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
                    {showSaldo && <th className="text-center py-3 px-4 font-medium text-muted-foreground w-20">Saldo</th>}
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
                        {showSaldo && (
                          <td className="py-3 px-4 text-center text-muted-foreground">
                            {item.saldo !== undefined ? item.saldo : '—'}
                          </td>
                        )}
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
                    {showSaldo && <td></td>}
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