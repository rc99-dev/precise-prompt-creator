import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/helpers";
import { BarChart3, TrendingUp, Clock, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, LineChart } from "recharts";
import { useQuery } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const purchasesConfig: ChartConfig = {
  total: { label: "Total (R$)", color: "hsl(var(--primary))" },
  count: { label: "Qtd Pedidos", color: "hsl(var(--accent))" },
};
const suppliersConfig: ChartConfig = { total: { label: "Total (R$)", color: "hsl(var(--primary))" } };
const approvalConfig: ChartConfig = { dias: { label: "Dias", color: "hsl(var(--primary))" } };

async function fetchReportData(year: string) {
  const yearNum = parseInt(year);
  const startDate = `${yearNum}-01-01`;
  const endDate = `${yearNum + 1}-01-01`;

  const [ordersRes, itemsRes, approvalRes] = await Promise.all([
    supabase.from("purchase_orders").select("id, created_at, total, status, approved_at, modo")
      .gte("created_at", startDate).lt("created_at", endDate).not("status", "eq", "cancelado"),
    supabase.from("purchase_order_items").select("order_id, supplier_id, subtotal, suppliers(razao_social)")
      .not("supplier_id", "is", null),
    supabase.from("approval_log").select("order_id, created_at, action")
      .eq("action", "aprovado").gte("created_at", startDate).lt("created_at", endDate),
  ]);
  if (ordersRes.error || itemsRes.error || approvalRes.error) throw new Error("Erro ao carregar relatórios");

  const orders = ordersRes.data || [];
  const items = (itemsRes.data || []) as any[];
  const approvals = approvalRes.data || [];

  const monthMap = new Map<number, { total: number; count: number }>();
  for (let i = 0; i < 12; i++) monthMap.set(i, { total: 0, count: 0 });
  const orderMap = new Map<string, any>();
  orders.forEach((o) => {
    orderMap.set(o.id, o);
    const m = new Date(o.created_at).getMonth();
    const entry = monthMap.get(m)!;
    entry.total += o.total || 0;
    entry.count += 1;
  });
  const monthlyData = Array.from(monthMap.entries()).map(([m, d]) => ({
    month: MONTHS[m], total: Math.round(d.total * 100) / 100, count: d.count,
  }));

  const supplierTotals = new Map<string, { name: string; total: number }>();
  items.forEach((item) => {
    const name = (item.suppliers as any)?.razao_social || "Sem fornecedor";
    const existing = supplierTotals.get(name) || { name, total: 0 };
    existing.total += item.subtotal || 0;
    supplierTotals.set(name, existing);
  });
  const supplierRanking = Array.from(supplierTotals.values()).sort((a, b) => b.total - a.total).slice(0, 10);

  const approvalMonths = new Map<number, { totalDays: number; count: number }>();
  for (let i = 0; i < 12; i++) approvalMonths.set(i, { totalDays: 0, count: 0 });
  approvals.forEach((a) => {
    const order = orderMap.get(a.order_id);
    if (order) {
      const days = Math.max(0, (new Date(a.created_at).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const m = new Date(a.created_at).getMonth();
      const entry = approvalMonths.get(m)!;
      entry.totalDays += days;
      entry.count += 1;
    }
  });
  const approvalTimes = Array.from(approvalMonths.entries()).map(([m, d]) => ({
    month: MONTHS[m], dias: d.count > 0 ? Math.round((d.totalDays / d.count) * 10) / 10 : 0,
  }));

  const bestPriceTotal = orders.filter(o => o.modo === "melhor_preco").reduce((s, o) => s + (o.total || 0), 0);
  const singleTotal = orders.filter(o => o.modo === "melhor_fornecedor").reduce((s, o) => s + (o.total || 0), 0);
  const savings = { bestPrice: bestPriceTotal, singleSupplier: singleTotal, economy: Math.max(0, singleTotal - bestPriceTotal) };

  const totalValue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const allApprovalDays = approvals
    .map(a => { const o = orderMap.get(a.order_id); return o ? (new Date(a.created_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24) : null; })
    .filter((d): d is number => d !== null);
  const avgApproval = allApprovalDays.length > 0 ? Math.round((allApprovalDays.reduce((s, d) => s + d, 0) / allApprovalDays.length) * 10) / 10 : 0;

  return { monthlyData, supplierRanking, approvalTimes, savings, totals: { orders: orders.length, totalValue, avgApproval } };
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', year],
    queryFn: () => fetchReportData(year),
    staleTime: 5 * 60 * 1000,
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const { monthlyData = [], supplierRanking = [], approvalTimes = [], savings = { bestPrice: 0, singleSupplier: 0, economy: 0 }, totals = { orders: 0, totalValue: 0, avgApproval: 0 } } = data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Indicadores e relatórios gerenciais</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Card key={i}><CardContent className="py-6"><TableSkeleton columns={1} rows={2} /></CardContent></Card>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardContent><TableSkeleton columns={3} rows={6} /></CardContent></Card>
            <Card><CardContent><TableSkeleton columns={3} rows={6} /></CardContent></Card>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos no Ano</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{totals.orders}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Comprado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{formatCurrency(totals.totalValue)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Economia Estimada</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold text-success">{formatCurrency(savings.economy)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio Aprovação</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{totals.avgApproval} <span className="text-base font-normal text-muted-foreground">dias</span></div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Total de Compras por Mês</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={purchasesConfig} className="h-[300px] w-full">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => name === "total" ? formatCurrency(Number(value)) : String(value)} />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking de Fornecedores (Top 10)</CardTitle></CardHeader>
              <CardContent>
                {supplierRanking.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-12">Sem dados de fornecedores</p>
                ) : (
                  <ChartContainer config={suppliersConfig} className="h-[300px] w-full">
                    <BarChart data={supplierRanking} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent formatter={value => formatCurrency(Number(value))} />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Tempo Médio de Aprovação (dias)</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={approvalConfig} className="h-[300px] w-full">
                  <LineChart data={approvalTimes} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent formatter={value => `${value} dias`} />} />
                    <Line type="monotone" dataKey="dias" stroke="var(--color-dias)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Economia por Estratégia</CardTitle></CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pedidos "Melhor Preço por Item"</p>
                    <p className="text-xl font-bold">{formatCurrency(savings.bestPrice)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary opacity-50" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pedidos "Melhor Fornecedor Único"</p>
                    <p className="text-xl font-bold">{formatCurrency(savings.singleSupplier)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-accent opacity-50" />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Economia estimada total</p>
                      <p className="text-xs text-muted-foreground">Diferença entre estratégia mais cara e mais barata</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{formatCurrency(savings.economy)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
