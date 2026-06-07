import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

const STATUSES = ['aguardando_aprovacao', 'aprovado', 'emitido', 'recebido', 'recebido_com_ocorrencia'];

type OrderRow = {
  id: string; numero: string; titulo: string | null; status: string;
  created_at: string; total: number; unidade_setor: string | null;
};

type ItemRow = {
  order_id: string; product_id: string; supplier_id: string | null;
  quantidade: number; preco_unitario: number; subtotal: number;
  product_nome: string; supplier_nome: string;
};

async function fetchOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, numero, titulo, status, created_at, total, unidade_setor')
    .in('status', STATUSES)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as OrderRow[];
}

async function fetchItems(orderIds: string[]): Promise<ItemRow[]> {
  if (!orderIds.length) return [];
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('order_id, product_id, supplier_id, quantidade, preco_unitario, subtotal, products(nome), suppliers(razao_social, nome_fantasia)')
    .in('order_id', orderIds);
  if (error) throw error;
  return (data || []).map((it: any) => ({
    order_id: it.order_id,
    product_id: it.product_id,
    supplier_id: it.supplier_id,
    quantidade: Number(it.quantidade || 0),
    preco_unitario: Number(it.preco_unitario || 0),
    subtotal: Number(it.subtotal || 0),
    product_nome: it.products?.nome || '—',
    supplier_nome: it.suppliers?.nome_fantasia || it.suppliers?.razao_social || 'Sem fornecedor',
  }));
}

function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function VarBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Math.abs(value) < 0.01) return <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" />0%</Badge>;
  const up = value > 0;
  return (
    <Badge variant="outline" className={`gap-1 ${up ? 'text-destructive border-destructive/40' : 'text-success border-success/40'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value.toFixed(1)}%
    </Badge>
  );
}

export default function FinancialComparisonPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const { data: orders, isLoading } = useQuery({ queryKey: ['fin-orders'], queryFn: fetchOrders });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return orders || [];
    return (orders || []).filter(o =>
      o.numero.toLowerCase().includes(s) ||
      (o.titulo || '').toLowerCase().includes(s) ||
      (o.unidade_setor || '').toLowerCase().includes(s)
    );
  }, [orders, search]);

  const selectedOrders = useMemo(() => {
    return (orders || [])
      .filter(o => selected.has(o.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders, selected]);

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['fin-items', selectedOrders.map(o => o.id)],
    queryFn: () => fetchItems(selectedOrders.map(o => o.id)),
    enabled: analyzing && selectedOrders.length >= 1,
  });

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // KPIs
  const kpis = useMemo(() => {
    if (!selectedOrders.length) return null;
    const totals = selectedOrders.map(o => Number(o.total || 0));
    const total = totals.reduce((a, b) => a + b, 0);
    const avg = total / totals.length;
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    const itemsCount = (items || []).reduce((a, b) => a + b.quantidade, 0);
    const uniqueProducts = new Set((items || []).map(i => i.product_id)).size;
    const uniqueSuppliers = new Set((items || []).map(i => i.supplier_id).filter(Boolean)).size;
    const avgTicketItem = itemsCount > 0 ? total / itemsCount : 0;
    // Variação total entre 1ª e última
    const variation = totals.length >= 2 ? pct(totals[totals.length - 1], totals[0]) : null;
    return { total, avg, max, min, itemsCount, uniqueProducts, uniqueSuppliers, avgTicketItem, variation };
  }, [selectedOrders, items]);

  // Por fornecedor — totais por ordem
  const supplierMatrix = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, { nome: string; perOrder: Record<string, number>; total: number }>();
    items.forEach(it => {
      const key = it.supplier_id || '__none__';
      if (!map.has(key)) map.set(key, { nome: it.supplier_nome, perOrder: {}, total: 0 });
      const e = map.get(key)!;
      e.perOrder[it.order_id] = (e.perOrder[it.order_id] || 0) + it.subtotal;
      e.total += it.subtotal;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [items]);

  // Por produto — variação de preço unitário e gasto
  const productMatrix = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, { nome: string; perOrder: Record<string, { qty: number; price: number; spent: number }>; totalSpent: number; totalQty: number }>();
    items.forEach(it => {
      if (!map.has(it.product_id)) map.set(it.product_id, { nome: it.product_nome, perOrder: {}, totalSpent: 0, totalQty: 0 });
      const e = map.get(it.product_id)!;
      const cur = e.perOrder[it.order_id] || { qty: 0, price: 0, spent: 0 };
      cur.qty += it.quantidade;
      cur.spent += it.subtotal;
      // weighted price
      cur.price = cur.qty > 0 ? cur.spent / cur.qty : 0;
      e.perOrder[it.order_id] = cur;
      e.totalSpent += it.subtotal;
      e.totalQty += it.quantidade;
    });
    return Array.from(map.entries())
      .map(([productId, info]) => {
        const orderIds = selectedOrders.map(o => o.id);
        const prices = orderIds.map(oid => info.perOrder[oid]?.price ?? null);
        const firstP = prices.find(p => p !== null && p > 0) ?? null;
        const lastP = [...prices].reverse().find(p => p !== null && p > 0) ?? null;
        const variation = firstP && lastP && firstP !== lastP ? pct(lastP, firstP) : null;
        const avgPrice = info.totalQty > 0 ? info.totalSpent / info.totalQty : 0;
        return { productId, ...info, variation, avgPrice };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [items, selectedOrders]);

  // Insights: maiores variações de preço e fornecedor com maior gasto
  const insights = useMemo(() => {
    const priceUp = productMatrix.filter(p => p.variation !== null && p.variation > 5).sort((a, b) => (b.variation! - a.variation!)).slice(0, 5);
    const priceDown = productMatrix.filter(p => p.variation !== null && p.variation < -5).sort((a, b) => (a.variation! - b.variation!)).slice(0, 5);
    const topSupplier = supplierMatrix[0];
    const topProduct = productMatrix[0];
    return { priceUp, priceDown, topSupplier, topProduct };
  }, [productMatrix, supplierMatrix]);

  if (analyzing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comparativo Financeiro</h1>
            <p className="text-sm text-muted-foreground">{selectedOrders.length} ordem(ns) em análise</p>
          </div>
          <Button variant="outline" onClick={() => setAnalyzing(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para seleção
          </Button>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Gasto total</div><div className="text-xl font-bold">{formatCurrency(kpis.total)}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Ticket médio / ordem</div><div className="text-xl font-bold">{formatCurrency(kpis.avg)}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Maior ordem</div><div className="text-xl font-bold">{formatCurrency(kpis.max)}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Menor ordem</div><div className="text-xl font-bold">{formatCurrency(kpis.min)}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Itens (qtd total)</div><div className="text-xl font-bold">{kpis.itemsCount.toLocaleString('pt-BR')}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Produtos únicos</div><div className="text-xl font-bold">{kpis.uniqueProducts}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Fornecedores</div><div className="text-xl font-bold">{kpis.uniqueSuppliers}</div></CardContent></Card>
            <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Variação 1ª → última</div><div className="text-xl font-bold"><VarBadge value={kpis.variation} /></div></CardContent></Card>
          </div>
        )}

        {loadingItems ? <Skeleton className="h-64 w-full" /> : (
        <Tabs defaultValue="ordens" className="w-full">
          <TabsList>
            <TabsTrigger value="ordens">Por ordem</TabsTrigger>
            <TabsTrigger value="fornecedor">Por fornecedor</TabsTrigger>
            <TabsTrigger value="produto">Por produto / preço</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="ordens">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Número</TableHead><TableHead>Título</TableHead><TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead><TableHead>Data</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Δ vs anterior</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {selectedOrders.map((o, i) => {
                    const prev = i > 0 ? Number(selectedOrders[i - 1].total) : null;
                    const v = prev !== null ? pct(Number(o.total), prev) : null;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                        <TableCell>{o.titulo || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.unidade_setor || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(Number(o.total))}</TableCell>
                        <TableCell className="text-right"><VarBadge value={v} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="fornecedor">
            <Card><CardContent className="pt-6">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Fornecedor</TableHead>
                    {selectedOrders.map(o => <TableHead key={o.id} className="text-right border-l">{o.numero}</TableHead>)}
                    <TableHead className="text-right border-l">Total</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {supplierMatrix.map(s => {
                      const totalAll = supplierMatrix.reduce((a, b) => a + b.total, 0);
                      return (
                        <TableRow key={s.nome}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">{s.nome}</TableCell>
                          {selectedOrders.map(o => (
                            <TableCell key={o.id} className="text-right border-l tabular-nums">
                              {s.perOrder[o.id] ? formatCurrency(s.perOrder[o.id]) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                          ))}
                          <TableCell className="text-right border-l font-semibold tabular-nums">{formatCurrency(s.total)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{totalAll > 0 ? ((s.total / totalAll) * 100).toFixed(1) + '%' : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="produto">
            <Card><CardContent className="pt-6">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Produto</TableHead>
                    {selectedOrders.map(o => (
                      <TableHead key={o.id} className="text-center border-l min-w-[140px]">
                        <div className="font-semibold text-xs">{o.numero}</div>
                        <div className="flex gap-2 justify-center mt-1 text-[10px] uppercase text-muted-foreground">
                          <span className="w-14">Preço</span><span className="w-16">Gasto</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-right border-l">Preço médio</TableHead>
                    <TableHead className="text-right">Gasto total</TableHead>
                    <TableHead className="text-right">Δ preço</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {productMatrix.map(p => (
                      <TableRow key={p.productId}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">{p.nome}</TableCell>
                        {selectedOrders.map(o => {
                          const c = p.perOrder[o.id];
                          return (
                            <TableCell key={o.id} className="border-l text-center tabular-nums text-xs">
                              {c ? (
                                <div className="flex gap-2 justify-center">
                                  <span className="w-14">{formatCurrency(c.price)}</span>
                                  <span className="w-16 text-muted-foreground">{formatCurrency(c.spent)}</span>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right border-l tabular-nums">{formatCurrency(p.avgPrice)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(p.totalSpent)}</TableCell>
                        <TableCell className="text-right"><VarBadge value={p.variation} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="insights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-destructive" /> Maiores altas de preço</CardTitle></CardHeader>
                <CardContent>
                  {insights.priceUp.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alta relevante (&gt;5%).</p> : (
                    <ul className="space-y-2 text-sm">
                      {insights.priceUp.map(p => (
                        <li key={p.productId} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                          <span className="truncate">{p.nome}</span>
                          <VarBadge value={p.variation} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-success" /> Maiores quedas de preço</CardTitle></CardHeader>
                <CardContent>
                  {insights.priceDown.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma queda relevante (&gt;5%).</p> : (
                    <ul className="space-y-2 text-sm">
                      {insights.priceDown.map(p => (
                        <li key={p.productId} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                          <span className="truncate">{p.nome}</span>
                          <VarBadge value={p.variation} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {insights.topSupplier && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Fornecedor com maior gasto</CardTitle></CardHeader>
                  <CardContent>
                    <p className="font-semibold">{insights.topSupplier.nome}</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(insights.topSupplier.total)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpis && kpis.total > 0 ? `${((insights.topSupplier.total / kpis.total) * 100).toFixed(1)}% do total` : ''}
                    </p>
                  </CardContent>
                </Card>
              )}
              {insights.topProduct && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Produto com maior gasto</CardTitle></CardHeader>
                  <CardContent>
                    <p className="font-semibold">{insights.topProduct.nome}</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(insights.topProduct.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qtd. total: {insights.topProduct.totalQty.toLocaleString('pt-BR')} • Preço médio: {formatCurrency(insights.topProduct.avgPrice)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Comparativo Financeiro</h1>
        <p className="text-sm text-muted-foreground">Selecione 1 ou mais ordens para análise financeira completa.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Ordens disponíveis</CardTitle>
          <div className="flex gap-2 items-center">
            <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
            <Badge variant="secondary">{selected.size} selecionadas</Badge>
            <Button onClick={() => setAnalyzing(true)} disabled={selected.size < 1}>
              <DollarSign className="h-4 w-4 mr-2" />Analisar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="border rounded-md max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Número</TableHead><TableHead>Título</TableHead>
                    <TableHead>Setor</TableHead><TableHead>Status</TableHead>
                    <TableHead>Criada</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(o => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => toggle(o.id)} data-state={selected.has(o.id) ? 'selected' : undefined}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                      <TableCell>{o.titulo || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.unidade_setor || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(o.total))}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma ordem.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
