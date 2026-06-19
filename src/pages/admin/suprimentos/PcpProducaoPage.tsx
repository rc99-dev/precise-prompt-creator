import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { producaoConfig } from "@/lib/pcpConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatCurrency } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

export default function PcpProducaoPage() {
  const { data } = useQuery({
    queryKey: ["pcp-producao-charts"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("pcp_producao").select("*").order("data", { ascending: true }).limit(1000);
      const arr = rows ?? [];
      const byDate: Record<string, { data: string; produzida: number; descartada: number; cmv: number }> = {};
      arr.forEach((r: any) => {
        if (!r.data) return;
        byDate[r.data] ??= { data: r.data, produzida: 0, descartada: 0, cmv: 0 };
        byDate[r.data].produzida += +r.quantidade_produzida_kg || 0;
        byDate[r.data].descartada += +r.quantidade_descartada_kg || 0;
        byDate[r.data].cmv += +r.cmv_total || 0;
      });
      const evolucao = Object.values(byDate).map(v => ({
        ...v, perda: v.produzida > 0 ? +(v.descartada / v.produzida * 100).toFixed(2) : 0,
      }));
      const byProd: Record<string, { total: number; qtd: number }> = {};
      arr.forEach((r: any) => {
        if (!r.produto) return;
        byProd[r.produto] ??= { total: 0, qtd: 0 };
        byProd[r.produto].total += +r.cmv_total || 0;
        byProd[r.produto].qtd += +r.quantidade_produzida_kg || 0;
      });
      const ranking = Object.entries(byProd).map(([produto, v]) => ({
        produto, cmvMedio: v.qtd > 0 ? v.total / v.qtd : 0, total: v.total,
      })).sort((a, b) => b.cmvMedio - a.cmvMedio).slice(0, 10);
      return { evolucao, ranking };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução: produção × perda (%)</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer><LineChart data={data?.evolucao ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line yAxisId="left" dataKey="produzida" name="Produzida (kg)" stroke="hsl(var(--primary))" />
              <Line yAxisId="right" dataKey="perda" name="% Perda" stroke="hsl(var(--destructive))" />
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Ranking de produtos por CMV médio</CardTitle></CardHeader>
          <CardContent>
            {!data?.ranking?.length ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ol className="space-y-1.5">
                {data.ranking.map((r, i) => (
                  <li key={r.produto} className="flex items-center justify-between text-sm border-b border-border pb-1.5">
                    <span><span className="text-muted-foreground mr-2">#{i + 1}</span>{r.produto}</span>
                    <Badge variant="secondary">{formatCurrency(r.cmvMedio)}/kg</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      <PcpCrudTab config={producaoConfig} />
    </div>
  );
}
