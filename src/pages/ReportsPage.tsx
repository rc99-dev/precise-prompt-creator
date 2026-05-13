import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { BarChart3, TrendingUp, DollarSign, Building2, Package, FileSpreadsheet, FileText, Calendar as CalendarIcon, Layers, MapPin, Users, ShoppingBag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";
import { exportSectionExcel, exportSectionPDF, type ReportSection } from "@/lib/reportExports";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUSES_REALIZADAS = ["aprovado", "emitido", "recebido", "recebido_com_ocorrencia"];
const STATUSES_RECEBIDAS = ["recebido", "recebido_com_ocorrencia"];

type Preset = "mes" | "30d" | "90d" | "ano" | "custom";

function presetRange(p: Preset): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  if (p === "mes") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else if (p === "30d") { start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0); }
  else if (p === "90d") { start.setDate(start.getDate() - 90); start.setHours(0, 0, 0, 0); }
  else if (p === "ano") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  return { start, end };
}

const chartCfg: ChartConfig = { total: { label: "Total (R$)", color: "hsl(var(--primary))" } };

function ExportButtons({ section }: { section: ReportSection }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => exportSectionExcel(section)}>
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportSectionPDF(section)}>
        <FileText className="h-4 w-4 mr-1" /> PDF
      </Button>
    </div>
  );
}

async function fetchReports(view: "realizadas" | "recebidas", startISO: string, endISO: string) {
  const countable = view === "recebidas" ? STATUSES_RECEBIDAS : STATUSES_REALIZADAS;
  const [ordersRes, itemsRes, suppliersCount, productsCount] = await Promise.all([
    supabase.from("purchase_orders")
      .select("id, created_at, total, status, unidade, user_id")
      .gte("created_at", startISO).lte("created_at", endISO),
    supabase.from("purchase_order_items")
      .select("order_id, supplier_id, quantidade, subtotal, products(id, nome, categoria, unidade_medida), suppliers(razao_social)")
      .limit(20000),
    supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "ativo"),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const allOrders = (ordersRes.data || []) as any[];
  const orders = allOrders.filter((o) => countable.includes(o.status));
  const orderIds = new Set(orders.map((o) => o.id));
  const items = ((itemsRes.data || []) as any[]).filter((it) => orderIds.has(it.order_id));

  // Buyers (need names)
  const buyerIds = Array.from(new Set(orders.map((o) => o.user_id).filter(Boolean)));
  const nameMap: Record<string, string> = {};
  if (buyerIds.length) {
    try {
      const { data: names } = await supabase.rpc("get_profile_names", { _user_ids: buyerIds } as any);
      (names || []).forEach((n: any) => { if (n.full_name) nameMap[n.user_id] = n.full_name; });
    } catch { /* ignore */ }
    const missing = buyerIds.filter((id) => !nameMap[id]);
    if (missing.length) {
      const { data: prof } = await supabase.from("profiles").select("user_id, full_name").in("user_id", missing);
      (prof || []).forEach((p: any) => { if (p.full_name) nameMap[p.user_id] = p.full_name; });
    }
  }

  const totalValue = orders.reduce((s, o) => s + (o.total || 0), 0);

  // Categoria
  const catMap: Record<string, number> = {};
  // Unidade
  const uniMap: Record<string, number> = {};
  const orderById: Record<string, any> = {};
  orders.forEach((o) => { orderById[o.id] = o; });
  items.forEach((it) => {
    const cat = (it.products?.categoria || "Sem categoria") as string;
    catMap[cat] = (catMap[cat] || 0) + (it.subtotal || 0);
  });
  orders.forEach((o) => {
    const u = o.unidade || "Sem unidade";
    uniMap[u] = (uniMap[u] || 0) + (o.total || 0);
  });
  const byCategory = Object.entries(catMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const byUnit = Object.entries(uniMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

  // Supplier ranking
  const supMap: Record<string, { name: string; total: number }> = {};
  items.forEach((it) => {
    const k = it.supplier_id || it.suppliers?.razao_social || "Sem fornecedor";
    const name = it.suppliers?.razao_social || "Sem fornecedor";
    if (!supMap[k]) supMap[k] = { name, total: 0 };
    supMap[k].total += it.subtotal || 0;
  });
  const supplierRanking = Object.values(supMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // Produtos mais comprados
  const prodMap: Record<string, { nome: string; categoria: string; unidade: string; qtd: number; total: number }> = {};
  items.forEach((it) => {
    const id = it.products?.id || "_";
    if (!prodMap[id]) prodMap[id] = {
      nome: it.products?.nome || "—",
      categoria: it.products?.categoria || "—",
      unidade: it.products?.unidade_medida || "un",
      qtd: 0, total: 0,
    };
    prodMap[id].qtd += Number(it.quantidade) || 0;
    prodMap[id].total += Number(it.subtotal) || 0;
  });
  const products = Object.values(prodMap);
  const topByQty = [...products].sort((a, b) => b.qtd - a.qtd).slice(0, 20);
  const topByValue = [...products].sort((a, b) => b.total - a.total).slice(0, 20);
  const sumValue = products.reduce((s, p) => s + p.total, 0) || 1;

  // Compradores
  const buyerMap: Record<string, { nome: string; pedidos: number; total: number }> = {};
  orders.forEach((o) => {
    const id = o.user_id || "_";
    if (!buyerMap[id]) buyerMap[id] = { nome: nameMap[id] || "—", pedidos: 0, total: 0 };
    buyerMap[id].pedidos += 1;
    buyerMap[id].total += o.total || 0;
  });
  const buyerRanking = Object.values(buyerMap).sort((a, b) => b.total - a.total);

  return {
    totals: {
      orders: orders.length,
      totalValue,
      suppliers: suppliersCount.count || 0,
      products: productsCount.count || 0,
    },
    byCategory, byUnit, supplierRanking, topByQty, topByValue, sumValue, buyerRanking,
  };
}

export default function ReportsPage() {
  const [view, setView] = useState<"realizadas" | "recebidas">("realizadas");
  const [preset, setPreset] = useState<Preset>("mes");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const { start, end } = useMemo(() => {
    if (preset === "custom" && customRange.from && customRange.to) {
      const s = new Date(customRange.from); s.setHours(0, 0, 0, 0);
      const e = new Date(customRange.to); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    return presetRange(preset === "custom" ? "mes" : preset);
  }, [preset, customRange]);

  const periodLabel = `${formatDate(start.toISOString())} a ${formatDate(end.toISOString())}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports-v2", view, start.toISOString(), end.toISOString()],
    queryFn: () => fetchReports(view, start.toISOString(), end.toISOString()),
    staleTime: 60_000,
  });

  const d = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Indicadores e relatórios gerenciais</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="realizadas">Realizadas</TabsTrigger>
              <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="ano">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !customRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange.from && customRange.to
                    ? `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`
                    : "Selecionar período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange as any}
                  onSelect={(r: any) => setCustomRange(r || {})}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Período aplicado: <strong>{periodLabel}</strong></p>

      {isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : isLoading || !d ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="py-6"><TableSkeleton columns={1} rows={2} /></CardContent></Card>)}
          </div>
          <Card><CardContent><TableSkeleton columns={4} rows={6} /></CardContent></Card>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de pedidos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{d.totals.orders}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold currency">{formatCurrency(d.totals.totalValue)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores ativos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{d.totals.suppliers}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Produtos cadastrados</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{d.totals.products}</div></CardContent>
            </Card>
          </div>

          {/* Categoria + Unidade */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" />Compras por categoria</CardTitle>
                <ExportButtons section={{
                  title: `Compras por categoria (${view})`, periodLabel,
                  columns: ["Categoria", "Total (R$)"],
                  rows: d.byCategory.map((c) => [c.nome, c.total.toFixed(2)]),
                  footer: `Total: ${formatCurrency(d.byCategory.reduce((s, c) => s + c.total, 0))}`,
                }} />
              </CardHeader>
              <CardContent>
                {d.byCategory.length === 0 ? <p className="text-muted-foreground text-sm text-center py-12">Sem dados</p> : (
                  <ChartContainer config={chartCfg} className="h-[300px] w-full">
                    <BarChart data={d.byCategory.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Compras por unidade</CardTitle>
                <ExportButtons section={{
                  title: `Compras por unidade (${view})`, periodLabel,
                  columns: ["Unidade", "Total (R$)"],
                  rows: d.byUnit.map((c) => [c.nome, c.total.toFixed(2)]),
                  footer: `Total: ${formatCurrency(d.byUnit.reduce((s, c) => s + c.total, 0))}`,
                }} />
              </CardHeader>
              <CardContent>
                {d.byUnit.length === 0 ? <p className="text-muted-foreground text-sm text-center py-12">Sem dados</p> : (
                  <ChartContainer config={chartCfg} className="h-[300px] w-full">
                    <BarChart data={d.byUnit} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Fornecedores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Ranking de fornecedores (Top 10)</CardTitle>
              <ExportButtons section={{
                title: `Ranking de fornecedores (${view})`, periodLabel,
                columns: ["Fornecedor", "Total (R$)"],
                rows: d.supplierRanking.map((s) => [s.name, s.total.toFixed(2)]),
                footer: `Total: ${formatCurrency(d.supplierRanking.reduce((s, x) => s + x.total, 0))}`,
              }} />
            </CardHeader>
            <CardContent>
              {d.supplierRanking.length === 0 ? <p className="text-muted-foreground text-sm text-center py-12">Sem dados</p> : (
                <ChartContainer config={chartCfg} className="h-[300px] w-full">
                  <BarChart data={d.supplierRanking} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Produtos mais comprados */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Produtos mais comprados</CardTitle>
              <ExportButtons section={{
                title: `Produtos mais comprados (${view})`, periodLabel,
                columns: ["Produto", "Categoria", "Quantidade", "Unidade", "Valor total (R$)"],
                rows: d.topByQty.map((p) => [p.nome, p.categoria, p.qtd, p.unidade, p.total.toFixed(2)]),
              }} />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.topByQty.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Quantidade</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topByQty.map((p, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{p.nome}</td>
                        <td className="py-2 px-2 text-muted-foreground">{p.categoria}</td>
                        <td className="py-2 px-2 text-right">{p.qtd.toLocaleString("pt-BR")} {p.unidade}</td>
                        <td className="py-2 px-2 text-right currency">{formatCurrency(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Ranking produtos x valor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />Ranking produtos × valor</CardTitle>
              <ExportButtons section={{
                title: `Ranking produtos por valor (${view})`, periodLabel,
                columns: ["Produto", "Valor total (R$)", "% do total"],
                rows: d.topByValue.map((p) => [p.nome, p.total.toFixed(2), `${((p.total / d.sumValue) * 100).toFixed(2)}%`]),
                footer: `Total geral: ${formatCurrency(d.sumValue)}`,
              }} />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.topByValue.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Valor total</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">% do total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topByValue.map((p, i) => {
                      const pct = (p.total / d.sumValue) * 100;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-2 font-medium">{p.nome}</td>
                          <td className="py-2 px-2 text-right currency">{formatCurrency(p.total)}</td>
                          <td className="py-2 px-2 text-right">{pct.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Compradores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Ranking de compradores</CardTitle>
              <ExportButtons section={{
                title: `Ranking de compradores (${view})`, periodLabel,
                columns: ["Comprador", "Pedidos", "Valor total (R$)"],
                rows: d.buyerRanking.map((b) => [b.nome, b.pedidos, b.total.toFixed(2)]),
                footer: `Total: ${formatCurrency(d.buyerRanking.reduce((s, b) => s + b.total, 0))}`,
              }} />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.buyerRanking.length === 0 ? <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Comprador</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Pedidos</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.buyerRanking.map((b, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{b.nome}</td>
                        <td className="py-2 px-2 text-right">{b.pedidos}</td>
                        <td className="py-2 px-2 text-right currency">{formatCurrency(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
