import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/helpers";
import { Package, TrendingUp, AlertTriangle, DollarSign, Boxes, Truck } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend } from "recharts";

function monthStartIso(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10);
}
function daysFromToday(date: string) {
  const a = new Date(date + "T12:00:00");
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export default function PcpDashboardPage() {
  const ms = monthStartIso();
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["pcp-dashboard-v2", ms],
    queryFn: async () => {
      const [compras, rendimento, producao, validades, distribuicao, estoque] = await Promise.all([
        supabase.from("pcp_compras").select("custo_geral, peso_bruto_kg, data").gte("data", ms),
        supabase.from("pcp_rendimento").select("fornecedor, tipo_produto, pct_rendimento, data").gte("data", ms),
        supabase.from("pcp_producao").select("cmv_total, quantidade_descartada_kg, quantidade_produzida_kg, data, produto"),
        supabase.from("pcp_validades").select("produto, status, data_validade, quantidade_kg"),
        supabase.from("pcp_distribuicao").select("unidade_destino, custo_total, quantidade_kg, data").gte("data", ms),
        supabase.from("pcp_estoque_cdp").select("produto, estoque_final_kg, data").order("data", { ascending: true }).limit(300),
      ]);

      const totalCompras = (compras.data ?? []).reduce((s, r) => s + (Number(r.custo_geral) || 0), 0);

      // CMV
      const cmvDay = (producao.data ?? []).filter(r => r.data === today).reduce((s, r) => s + (+r.cmv_total || 0), 0);
      const cmvWeek = (producao.data ?? []).filter(r => r.data && r.data >= weekStart).reduce((s, r) => s + (+r.cmv_total || 0), 0);
      const cmvMonth = (producao.data ?? []).filter(r => r.data && r.data >= ms).reduce((s, r) => s + (+r.cmv_total || 0), 0);

      // Validades
      const valArr = (validades.data ?? []).filter(v => v.status !== "descartado" && v.data_validade);
      const vencidos = valArr.filter(v => daysFromToday(v.data_validade!) < 0 || v.status === "vencido").length;
      const ate3 = valArr.filter(v => { const d = daysFromToday(v.data_validade!); return d >= 0 && d <= 3; }).length;
      const ate7 = valArr.filter(v => { const d = daysFromToday(v.data_validade!); return d > 3 && d <= 7; }).length;

      // Distribuição por unidade
      const porUnidade: Record<string, { kg: number; custo: number }> = {};
      (distribuicao.data ?? []).forEach(d => {
        const u = d.unidade_destino || "—";
        porUnidade[u] ??= { kg: 0, custo: 0 };
        porUnidade[u].kg += +d.quantidade_kg || 0;
        porUnidade[u].custo += +d.custo_total || 0;
      });
      const distData = Object.entries(porUnidade).map(([unidade, v]) => ({ unidade, kg: +v.kg.toFixed(1), custo: +v.custo.toFixed(2) }));

      // Rendimento médio por fornecedor
      const rendMap: Record<string, number[]> = {};
      (rendimento.data ?? []).forEach(r => {
        if (r.pct_rendimento == null || !r.fornecedor) return;
        rendMap[r.fornecedor] ??= [];
        rendMap[r.fornecedor].push(+r.pct_rendimento);
      });
      const rendData = Object.entries(rendMap).map(([fornecedor, arr]) => ({
        fornecedor, rendimento: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2),
      })).sort((a, b) => b.rendimento - a.rendimento).slice(0, 10);

      // Evolução estoque CDP
      const stockMap: Record<string, number> = {};
      (estoque.data ?? []).forEach(e => {
        if (!e.data) return;
        stockMap[e.data] = (stockMap[e.data] || 0) + (+e.estoque_final_kg || 0);
      });
      const stockData = Object.entries(stockMap).map(([data, kg]) => ({ data, kg: +kg.toFixed(1) }));

      // Estoque atual por produto (último por produto)
      const lastByProd = new Map<string, { produto: string; kg: number; data: string }>();
      (estoque.data ?? []).forEach(e => {
        const cur = lastByProd.get(e.produto);
        if (!cur || (e.data && cur.data < e.data)) lastByProd.set(e.produto, { produto: e.produto, kg: +e.estoque_final_kg || 0, data: e.data || "" });
      });
      const estoqueAtual = Array.from(lastByProd.values()).sort((a, b) => b.kg - a.kg).slice(0, 10);

      return { totalCompras, cmvDay, cmvWeek, cmvMonth, vencidos, ate3, ate7, distData, rendData, stockData, estoqueAtual };
    },
  });

  const cards = [
    { label: "Compras do mês", value: formatCurrency(data?.totalCompras ?? 0), icon: DollarSign, color: "text-primary" },
    { label: "CMV hoje", value: formatCurrency(data?.cmvDay ?? 0), icon: Package, color: "text-info" },
    { label: "CMV 7 dias", value: formatCurrency(data?.cmvWeek ?? 0), icon: TrendingUp, color: "text-info" },
    { label: "CMV do mês", value: formatCurrency(data?.cmvMonth ?? 0), icon: Package, color: "text-success" },
    { label: "Vencidos", value: String(data?.vencidos ?? 0), icon: AlertTriangle, color: "text-destructive" },
    { label: "Vence ≤ 3 dias", value: String(data?.ate3 ?? 0), icon: AlertTriangle, color: "text-destructive" },
    { label: "Vence ≤ 7 dias", value: String(data?.ate7 ?? 0), icon: AlertTriangle, color: "text-warning" },
    { label: "Itens em estoque", value: String(data?.estoqueAtual?.length ?? 0), icon: Boxes, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Estoque atual na CDP por produto</CardTitle></CardHeader>
          <CardContent>
            {data?.estoqueAtual?.length ? (
              <div className="space-y-2">
                {data.estoqueAtual.map(e => (
                  <div key={e.produto} className="flex items-center justify-between text-sm border-b border-border pb-1.5">
                    <span>{e.produto}</span>
                    <Badge variant={e.kg < 10 ? "destructive" : e.kg < 30 ? "secondary" : "default"}>{e.kg.toFixed(1)} kg</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem registros.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuído por unidade (mês)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><BarChart data={data?.distData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="unidade" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="kg" fill="hsl(var(--primary))" />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Rendimento médio por fornecedor</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><BarChart data={data?.rendData ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="fornecedor" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="rendimento" fill="hsl(var(--success))" />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução do estoque CDP</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><LineChart data={data?.stockData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
