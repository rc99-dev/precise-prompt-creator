import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { UNIDADES } from "@/lib/constants";
import { Split, Truck, ShoppingCart, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

const MIN_KEY = "pcp_minimos";
function loadMinimos(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(MIN_KEY) || "{}"); } catch { return {}; }
}

type EstoqueRow = { produto: string; saldo: number; ultimoCusto: number };

export default function PcpTriagemPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [minimos] = useState<Record<string, number>>(loadMinimos());
  const [dialogProduto, setDialogProduto] = useState<EstoqueRow | null>(null);
  const [mode, setMode] = useState<"distribuir" | "comprar" | null>(null);
  const [qtPorUnidade, setQtPorUnidade] = useState<Record<string, string>>({});

  const { data: estoque = [] } = useQuery({
    queryKey: ["pcp-triagem-estoque"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pcp_estoque_cdp")
        .select("*")
        .order("data", { ascending: true })
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: rendimento = [] } = useQuery({
    queryKey: ["pcp-triagem-rendimento"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pcp_rendimento")
        .select("tipo_produto, valor_final_kg, valor_inicial_kg, fornecedor, data")
        .order("data", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const produtos: EstoqueRow[] = useMemo(() => {
    const map = new Map<string, EstoqueRow>();
    estoque.forEach((e: any) => {
      if (!e.produto) return;
      map.set(e.produto, {
        produto: e.produto,
        saldo: Number(e.estoque_final_kg) || 0,
        ultimoCusto:
          Number(
            rendimento.find((r: any) => r.tipo_produto === e.produto)?.valor_final_kg
          ) || 0,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.produto.localeCompare(b.produto));
  }, [estoque, rendimento]);

  const fornecedoresRecomendados = (produto: string) => {
    const arr = rendimento
      .filter((r: any) => r.tipo_produto === produto && r.fornecedor)
      .slice(0, 3)
      .map((r: any) => r.fornecedor);
    return Array.from(new Set(arr));
  };

  const semaforo = (saldo: number, min: number) => {
    if (!min) return { color: "bg-success/20 text-success", label: "ok", Icon: CheckCircle2 };
    if (saldo <= 0 || saldo < min * 0.5) return { color: "bg-destructive/20 text-destructive", label: "crítico", Icon: AlertTriangle };
    if (saldo < min) return { color: "bg-warning/20 text-warning", label: "atenção", Icon: AlertTriangle };
    return { color: "bg-success/20 text-success", label: "ok", Icon: CheckCircle2 };
  };

  const distribuirMut = useMutation({
    mutationFn: async () => {
      if (!dialogProduto) return;
      const today = new Date().toISOString().slice(0, 10);
      const rows = Object.entries(qtPorUnidade)
        .map(([u, q]) => ({ u, q: Number(q) }))
        .filter((r) => r.q > 0);
      if (rows.length === 0) throw new Error("Informe quantidade para pelo menos uma unidade.");
      const totalEnviado = rows.reduce((s, r) => s + r.q, 0);
      if (totalEnviado > dialogProduto.saldo)
        throw new Error(`Total (${totalEnviado.toFixed(2)} kg) excede o saldo CDP (${dialogProduto.saldo.toFixed(2)} kg).`);

      const custoUnit = dialogProduto.ultimoCusto || 0;

      // Insere distribuições
      const distPayload = rows.map((r) => ({
        data: today,
        produto: dialogProduto.produto,
        unidade_destino: r.u,
        quantidade_kg: r.q,
        custo_unitario_kg: custoUnit || null,
        custo_total: custoUnit ? custoUnit * r.q : null,
        user_id: user?.id ?? null,
      }));
      const { error: e1 } = await supabase.from("pcp_distribuicao").insert(distPayload);
      if (e1) throw e1;

      // Gera rateios pendentes (um por unidade)
      const rateioPayload = rows.map((r) => ({
        data_ref: today,
        produto: dialogProduto.produto,
        unidade_devedora: r.u,
        total_enviado_kg: r.q,
        custo_final: custoUnit ? custoUnit * r.q : null,
        enviou_rateio: false,
        user_id: user?.id ?? null,
      }));
      const { error: e2 } = await supabase.from("pcp_rateio").insert(rateioPayload);
      if (e2) throw e2;

      // Saída no estoque CDP
      const { error: e3 } = await supabase.from("pcp_estoque_cdp").insert({
        data: today,
        produto: dialogProduto.produto,
        estoque_inicial_kg: dialogProduto.saldo,
        entrada_kg: 0,
        saida_kg: totalEnviado,
        estoque_final_kg: dialogProduto.saldo - totalEnviado,
        user_id: user?.id ?? null,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      toast.success("Distribuição registrada. Rateios criados como pendentes.");
      qc.invalidateQueries({ queryKey: ["pcp-triagem-estoque"] });
      qc.invalidateQueries({ queryKey: ["pcp", "pcp_distribuicao"] });
      qc.invalidateQueries({ queryKey: ["pcp", "pcp_rateio"] });
      setDialogProduto(null); setMode(null); setQtPorUnidade({});
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar distribuição"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Split className="h-4 w-4" /> Triagem da CDP — decidir destino de cada produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Para cada produto disponível, escolha distribuir entre unidades internas ou gerar uma solicitação de compra externa.
            Configure o estoque mínimo por produto na aba <strong>CDP</strong>.
          </p>
          {produtos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem estoque registrado na CDP ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {produtos.map((p) => {
                const min = minimos[p.produto] ?? 0;
                const s = semaforo(p.saldo, min);
                return (
                  <div key={p.produto} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.produto}</div>
                        <div className="text-xs text-muted-foreground">
                          Saldo: <strong>{p.saldo.toFixed(2)} kg</strong>
                          {min > 0 && <> · mín. {min} kg</>}
                        </div>
                        {p.ultimoCusto > 0 && (
                          <div className="text-[11px] text-muted-foreground">Custo médio {formatCurrency(p.ultimoCusto)}/kg</div>
                        )}
                      </div>
                      <Badge className={s.color + " text-[10px]"}>
                        <s.Icon className="h-3 w-3 mr-1" />{s.label}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="outline" className="flex-1"
                        disabled={p.saldo <= 0}
                        onClick={() => { setDialogProduto(p); setMode("distribuir"); setQtPorUnidade({}); }}
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" /> Distribuir
                      </Button>
                      <Button
                        size="sm" variant="outline" className="flex-1"
                        onClick={() => { setDialogProduto(p); setMode("comprar"); }}
                      >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Comprar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Distribuir */}
      <Dialog
        open={!!dialogProduto && mode === "distribuir"}
        onOpenChange={(o) => { if (!o) { setDialogProduto(null); setMode(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir {dialogProduto?.produto}</DialogTitle>
            <DialogDescription>
              Saldo disponível: {dialogProduto?.saldo.toFixed(2)} kg ·
              Custo unit.: {formatCurrency(dialogProduto?.ultimoCusto || 0)}/kg
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {UNIDADES.map((u) => (
              <div key={u} className="flex items-center gap-2">
                <Label className="w-40 text-sm">{u}</Label>
                <Input
                  type="number" step="0.001" min="0" placeholder="kg"
                  value={qtPorUnidade[u] ?? ""}
                  onChange={(e) => setQtPorUnidade((p) => ({ ...p, [u]: e.target.value }))}
                />
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Total a enviar:{" "}
              <strong>
                {Object.values(qtPorUnidade).reduce((s, v) => s + (Number(v) || 0), 0).toFixed(2)} kg
              </strong>
              {dialogProduto?.ultimoCusto ? (
                <> · Custo total {formatCurrency(
                  Object.values(qtPorUnidade).reduce((s, v) => s + (Number(v) || 0), 0) * (dialogProduto?.ultimoCusto || 0)
                )}</>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogProduto(null); setMode(null); }}>Cancelar</Button>
            <Button onClick={() => distribuirMut.mutate()} disabled={distribuirMut.isPending}>
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Solicitar compra */}
      <Dialog
        open={!!dialogProduto && mode === "comprar"}
        onOpenChange={(o) => { if (!o) { setDialogProduto(null); setMode(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar compra externa — {dialogProduto?.produto}</DialogTitle>
            <DialogDescription>
              Encaminhar ao módulo de suprimentos para cotação e emissão de pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>Saldo atual CDP: <strong>{dialogProduto?.saldo.toFixed(2)} kg</strong></div>
            <div>
              Fornecedores recomendados (por histórico de rendimento):
              <div className="flex flex-wrap gap-1 mt-1">
                {fornecedoresRecomendados(dialogProduto?.produto || "").length === 0 ? (
                  <span className="text-xs text-muted-foreground">— sem histórico —</span>
                ) : fornecedoresRecomendados(dialogProduto?.produto || "").map((f) => (
                  <Badge key={f} variant="outline">{f}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogProduto(null); setMode(null); }}>Cancelar</Button>
            <Button onClick={() => { toast.success("Abrindo nova ordem de compra…"); navigate("/nova-ordem"); }}>
              Abrir Nova Ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
