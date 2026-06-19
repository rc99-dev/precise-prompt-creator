import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { distribuicaoConfig } from "@/lib/pcpConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UNIDADES } from "@/lib/constants";

export default function PcpDistribuicaoPage() {
  const { data: dist = [] } = useQuery({
    queryKey: ["pcp-distribuicao-grid"],
    queryFn: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const { data } = await supabase.from("pcp_distribuicao").select("*").gte("data", monthStart).limit(500);
      return data ?? [];
    },
  });

  const produtos = Array.from(new Set(dist.map((d: any) => d.produto).filter(Boolean)));
  const grid: Record<string, Record<string, number>> = {};
  produtos.forEach(p => { grid[p] = {}; UNIDADES.forEach(u => grid[p][u] = 0); });
  dist.forEach((d: any) => {
    if (!d.produto || !d.unidade_destino) return;
    grid[d.produto][d.unidade_destino] = (grid[d.produto][d.unidade_destino] || 0) + (+d.quantidade_kg || 0);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Grade: Produto × Unidade (mês atual, em kg)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {produtos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem distribuições neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  {UNIDADES.map(u => <TableHead key={u} className="text-right">{u}</TableHead>)}
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map(p => {
                  const total = UNIDADES.reduce((s, u) => s + grid[p][u], 0);
                  return (
                    <TableRow key={p}>
                      <TableCell className="font-medium">{p}</TableCell>
                      {UNIDADES.map(u => (
                        <TableCell key={u} className="text-right">{grid[p][u] > 0 ? grid[p][u].toFixed(1) : "—"}</TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{total.toFixed(1)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <PcpCrudTab config={distribuicaoConfig} />
    </div>
  );
}
