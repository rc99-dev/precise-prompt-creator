import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/helpers";
import { Package, TrendingDown, AlertTriangle, DollarSign, Boxes, Truck } from "lucide-react";

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function PcpDashboard() {
  const monthStart = startOfMonth();

  const { data: kpis } = useQuery({
    queryKey: ["pcp", "dashboard", monthStart],
    queryFn: async () => {
      const [compras, rendimento, producao, validades, distribuicao] = await Promise.all([
        supabase.from("pcp_compras").select("custo_geral, peso_bruto_kg").gte("data", monthStart),
        supabase.from("pcp_rendimento").select("pct_rendimento, pct_perda").gte("data", monthStart),
        supabase.from("pcp_producao").select("cmv_total, quantidade_descartada_kg, quantidade_produzida_kg").gte("data", monthStart),
        supabase.from("pcp_validades").select("status, data_validade"),
        supabase.from("pcp_distribuicao").select("custo_total, quantidade_kg").gte("data", monthStart),
      ]);

      const totalCompras = (compras.data ?? []).reduce((s, r) => s + (Number(r.custo_geral) || 0), 0);
      const kgComprado = (compras.data ?? []).reduce((s, r) => s + (Number(r.peso_bruto_kg) || 0), 0);

      const rendArr = (rendimento.data ?? []).filter((r) => r.pct_rendimento != null);
      const rendMedio = rendArr.length
        ? rendArr.reduce((s, r) => s + Number(r.pct_rendimento), 0) / rendArr.length
        : 0;

      const cmvTotal = (producao.data ?? []).reduce((s, r) => s + (Number(r.cmv_total) || 0), 0);
      const totalProd = (producao.data ?? []).reduce((s, r) => s + (Number(r.quantidade_produzida_kg) || 0), 0);
      const totalDesc = (producao.data ?? []).reduce((s, r) => s + (Number(r.quantidade_descartada_kg) || 0), 0);
      const perdaPct = totalProd > 0 ? (totalDesc / totalProd) * 100 : 0;

      const hoje = new Date();
      const em7dias = new Date();
      em7dias.setDate(hoje.getDate() + 7);
      const validadesArr = validades.data ?? [];
      const vencendo = validadesArr.filter(
        (v) => v.status !== "descartado" && v.data_validade && new Date(v.data_validade) <= em7dias && new Date(v.data_validade) >= hoje
      ).length;
      const vencidos = validadesArr.filter((v) => v.status === "vencido").length;

      const totalDistribuido = (distribuicao.data ?? []).reduce((s, r) => s + (Number(r.quantidade_kg) || 0), 0);
      const custoDistribuido = (distribuicao.data ?? []).reduce((s, r) => s + (Number(r.custo_total) || 0), 0);

      return {
        totalCompras, kgComprado, rendMedio, cmvTotal, perdaPct,
        vencendo, vencidos, totalDistribuido, custoDistribuido,
      };
    },
  });

  const cards = [
    { label: "Compras do mês", value: formatCurrency(kpis?.totalCompras ?? 0), sub: `${(kpis?.kgComprado ?? 0).toFixed(1)} kg`, icon: DollarSign, color: "text-primary" },
    { label: "Rendimento médio", value: `${(kpis?.rendMedio ?? 0).toFixed(1)}%`, sub: "média dos lotes", icon: TrendingDown, color: "text-success" },
    { label: "CMV do mês", value: formatCurrency(kpis?.cmvTotal ?? 0), sub: `${(kpis?.perdaPct ?? 0).toFixed(1)}% perda`, icon: Package, color: "text-info" },
    { label: "Validades próximas", value: String(kpis?.vencendo ?? 0), sub: `${kpis?.vencidos ?? 0} vencidos`, icon: AlertTriangle, color: "text-warning" },
    { label: "Distribuído", value: `${(kpis?.totalDistribuido ?? 0).toFixed(1)} kg`, sub: formatCurrency(kpis?.custoDistribuido ?? 0), icon: Truck, color: "text-primary" },
    { label: "Estoque CDP", value: "Ver aba", sub: "Estoque Central", icon: Boxes, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
