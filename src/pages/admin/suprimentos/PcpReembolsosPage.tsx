import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { reembolsosConfig } from "@/lib/pcpConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/helpers";

export default function PcpReembolsosPage() {
  const { data: pendencias = [] } = useQuery({
    queryKey: ["pcp-reembolsos-pendentes"],
    queryFn: async () => {
      const { data } = await supabase.from("pcp_reembolsos").select("*").eq("enviou_rateio", false).limit(500);
      const map: Record<string, { unidade: string; total: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        const u = r.unidade_devedora || "—";
        map[u] ??= { unidade: u, total: 0, count: 0 };
        map[u].total += +r.custo_final || 0;
        map[u].count += 1;
      });
      return Object.values(map).sort((a, b) => b.total - a.total);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Pendências de reembolso por unidade</CardTitle></CardHeader>
        <CardContent>
          {pendencias.length === 0 ? <p className="text-sm text-muted-foreground">Sem pendências.</p> : (
            <div className="space-y-2">
              {pendencias.map(p => (
                <div key={p.unidade} className="flex items-center justify-between border-b border-border pb-1.5 text-sm">
                  <span>{p.unidade}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.count} item(s)</Badge>
                    <span className="font-semibold text-warning">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <PcpCrudTab config={reembolsosConfig} />
    </div>
  );
}
