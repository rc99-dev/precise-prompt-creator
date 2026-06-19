import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { estoqueConfig } from "@/lib/pcpConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function PcpEstoquePage() {
  const [minimo, setMinimo] = useState(20);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");

  const { data: estoque = [] } = useQuery({
    queryKey: ["pcp-estoque-overview"],
    queryFn: async () => {
      const { data } = await supabase.from("pcp_estoque_cdp").select("*").order("data", { ascending: true }).limit(1000);
      return data ?? [];
    },
  });

  const produtos = Array.from(new Set(estoque.map((e: any) => e.produto).filter(Boolean)));
  const atual = produtos.map(p => {
    const rows = estoque.filter((e: any) => e.produto === p);
    const last = rows[rows.length - 1];
    return { produto: p, kg: +last?.estoque_final_kg || 0 };
  });
  const timeline = estoque
    .filter((e: any) => !produtoSelecionado || e.produto === produtoSelecionado)
    .map((e: any) => ({ data: e.data, kg: +e.estoque_final_kg || 0 }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Estoque atual por produto
            <div className="flex items-center gap-2 font-normal">
              <Label className="text-xs">Mínimo (kg):</Label>
              <Input type="number" value={minimo} onChange={e => setMinimo(+e.target.value)} className="h-8 w-20" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {atual.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {atual.map(p => (
                <button
                  key={p.produto}
                  onClick={() => setProdutoSelecionado(p.produto === produtoSelecionado ? "" : p.produto)}
                  className={`text-left p-3 rounded-md border transition-colors ${produtoSelecionado === p.produto ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}
                >
                  <div className="text-sm font-medium truncate">{p.produto}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-lg font-bold">{p.kg.toFixed(1)} kg</span>
                    {p.kg < minimo && <Badge variant="destructive" className="text-[10px]">Baixo</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Linha do tempo — {produtoSelecionado || "todos os produtos"}</CardTitle></CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer><LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer>
        </CardContent>
      </Card>

      <PcpCrudTab config={estoqueConfig} />
    </div>
  );
}
