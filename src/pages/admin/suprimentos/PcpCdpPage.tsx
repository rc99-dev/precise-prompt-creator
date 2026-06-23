import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Boxes, AlertTriangle, CheckCircle2, ClipboardList, Save } from "lucide-react";
import { useAuth as useAuthCtx } from "@/contexts/AuthContext";

const MIN_KEY = "pcp_minimos";
function loadMinimos(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(MIN_KEY) || "{}"); } catch { return {}; }
}
function saveMinimos(m: Record<string, number>) {
  localStorage.setItem(MIN_KEY, JSON.stringify(m));
}

export default function PcpCdpPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [minimos, setMinimos] = useState<Record<string, number>>(loadMinimos());
  const [produtoSel, setProdutoSel] = useState<string>("");
  const [invOpen, setInvOpen] = useState(false);
  const [invProduto, setInvProduto] = useState("");
  const [invKg, setInvKg] = useState("");

  useEffect(() => { saveMinimos(minimos); }, [minimos]);

  const { data: rows = [] } = useQuery({
    queryKey: ["pcp-cdp-mov"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pcp_estoque_cdp")
        .select("*")
        .order("data", { ascending: true })
        .limit(3000);
      return data ?? [];
    },
  });

  const saldos = useMemo(() => {
    const map = new Map<string, { produto: string; saldo: number; ultimoData: string }>();
    rows.forEach((r: any) => {
      map.set(r.produto, { produto: r.produto, saldo: Number(r.estoque_final_kg) || 0, ultimoData: r.data });
    });
    return Array.from(map.values()).sort((a, b) => a.produto.localeCompare(b.produto));
  }, [rows]);

  const movimentacoes = useMemo(
    () => [...rows].sort((a: any, b: any) => (b.data > a.data ? 1 : -1)).slice(0, 100),
    [rows]
  );

  const timeline = useMemo(
    () => rows
      .filter((r: any) => !produtoSel || r.produto === produtoSel)
      .map((r: any) => ({ data: r.data, kg: Number(r.estoque_final_kg) || 0 })),
    [rows, produtoSel]
  );

  const inventarioMut = useMutation({
    mutationFn: async () => {
      if (!invProduto || invKg === "") throw new Error("Informe produto e quantidade");
      const today = new Date().toISOString().slice(0, 10);
      const saldoAtual = saldos.find((s) => s.produto === invProduto)?.saldo ?? 0;
      const novo = Number(invKg);
      const diff = novo - saldoAtual;
      const { error } = await supabase.from("pcp_estoque_cdp").insert({
        data: today,
        produto: invProduto,
        estoque_inicial_kg: saldoAtual,
        entrada_kg: diff > 0 ? diff : 0,
        saida_kg: diff < 0 ? -diff : 0,
        estoque_final_kg: novo,
        inventario_kg: novo,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inventário registrado");
      qc.invalidateQueries({ queryKey: ["pcp-cdp-mov"] });
      qc.invalidateQueries({ queryKey: ["pcp-triagem-estoque"] });
      setInvOpen(false); setInvProduto(""); setInvKg("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const semaforo = (saldo: number, min: number) => {
    if (!min) return { c: "bg-muted text-muted-foreground", L: "—", I: CheckCircle2 };
    if (saldo <= 0 || saldo < min * 0.5) return { c: "bg-destructive/20 text-destructive", L: "crítico", I: AlertTriangle };
    if (saldo < min) return { c: "bg-warning/20 text-warning", L: "atenção", I: AlertTriangle };
    return { c: "bg-success/20 text-success", L: "ok", I: CheckCircle2 };
  };

  const alertas = saldos.filter((s) => {
    const m = minimos[s.produto] ?? 0;
    return m > 0 && s.saldo < m;
  });

  return (
    <div className="space-y-4">
      {alertas.length > 0 && (
        <Card className="border-warning/40">
          <CardContent className="py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div>
              <strong>{alertas.length} produto(s)</strong> abaixo do estoque mínimo:{" "}
              {alertas.map((a) => `${a.produto} (${a.saldo.toFixed(1)} kg)`).join(", ")}.
              Use a aba <strong>Triagem</strong> para gerar uma solicitação de compra externa.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Saldo atual da CDP</span>
            <Button size="sm" variant="outline" onClick={() => setInvOpen(true)}>
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> Fazer inventário
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {saldos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem dados de estoque.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Saldo (kg)</TableHead>
                  <TableHead className="w-40">Mínimo (kg)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última mov.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saldos.map((s) => {
                  const m = minimos[s.produto] ?? 0;
                  const sem = semaforo(s.saldo, m);
                  return (
                    <TableRow
                      key={s.produto}
                      className="cursor-pointer"
                      onClick={() => setProdutoSel(s.produto === produtoSel ? "" : s.produto)}
                    >
                      <TableCell className="font-medium">{s.produto}</TableCell>
                      <TableCell className="text-right font-semibold">{s.saldo.toFixed(2)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number" step="0.1" className="h-8"
                          value={minimos[s.produto] ?? ""}
                          onChange={(e) =>
                            setMinimos((p) => ({ ...p, [s.produto]: Number(e.target.value) || 0 }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={sem.c + " text-[10px]"}><sem.I className="h-3 w-3 mr-1" />{sem.L}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.ultimoData}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Linha do tempo do estoque — {produtoSel || "todos os produtos (clique uma linha acima)"}
          </CardTitle>
        </CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Histórico de movimentações</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoes.map((m: any) => {
                const tipo = m.inventario_kg != null ? "Inventário"
                  : (Number(m.entrada_kg) || 0) > 0 ? "Entrada" : "Saída";
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.data}</TableCell>
                    <TableCell>{m.produto}</TableCell>
                    <TableCell className="text-right">{Number(m.estoque_inicial_kg || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-success">{Number(m.entrada_kg || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive">{Number(m.saida_kg || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(m.estoque_final_kg || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{tipo}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contagem rápida de inventário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Produto</Label>
              <select
                className="w-full mt-1 bg-background border border-border rounded-md h-9 px-2 text-sm"
                value={invProduto}
                onChange={(e) => setInvProduto(e.target.value)}
              >
                <option value="">— selecione —</option>
                {saldos.map((s) => <option key={s.produto} value={s.produto}>{s.produto}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Quantidade contada (kg)</Label>
              <Input type="number" step="0.001" value={invKg} onChange={(e) => setInvKg(e.target.value)} />
              {invProduto && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo atual: {(saldos.find((s) => s.produto === invProduto)?.saldo ?? 0).toFixed(2)} kg
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvOpen(false)}>Cancelar</Button>
            <Button onClick={() => inventarioMut.mutate()} disabled={inventarioMut.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
