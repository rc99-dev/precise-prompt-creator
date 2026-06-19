import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { rendimentoConfig } from "@/lib/pcpConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PcpRendimentoPage() {
  const { data: ranking = [] } = useQuery({
    queryKey: ["pcp-ranking-rend"],
    queryFn: async () => {
      const { data } = await supabase.from("pcp_rendimento").select("fornecedor, pct_rendimento").limit(1000);
      const map: Record<string, number[]> = {};
      (data ?? []).forEach(r => {
        if (r.pct_rendimento == null || !r.fornecedor) return;
        map[r.fornecedor] ??= [];
        map[r.fornecedor].push(+r.pct_rendimento);
      });
      return Object.entries(map)
        .map(([f, arr]) => ({ fornecedor: f, media: arr.reduce((a, b) => a + b, 0) / arr.length, lotes: arr.length }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 10);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Ranking de fornecedores por rendimento médio</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
            <ol className="space-y-1.5">
              {ranking.map((r, i) => (
                <li key={r.fornecedor} className="flex items-center justify-between text-sm border-b border-border pb-1.5">
                  <span><span className="text-muted-foreground mr-2">#{i + 1}</span>{r.fornecedor}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.lotes} lote(s)</span>
                    <Badge variant={r.media >= 60 ? "default" : r.media >= 40 ? "secondary" : "destructive"}>
                      {r.media.toFixed(1)}%
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <PcpCrudTab config={rendimentoConfig} />
    </div>
  );
}
