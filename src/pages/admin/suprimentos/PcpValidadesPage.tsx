import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Printer, Plus } from "lucide-react";
import { UNIDADES } from "@/lib/constants";
import { formatDate } from "@/lib/helpers";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { validadesConfig } from "@/lib/pcpConfig";

function diasParaVencer(data: string): number {
  const a = new Date(data + "T12:00:00"); const b = new Date(); b.setHours(0,0,0,0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function statusByDays(d: number) {
  if (d < 0) return { label: "Vencido", color: "destructive" as const };
  if (d <= 3) return { label: `${d}d`, color: "destructive" as const };
  if (d <= 7) return { label: `${d}d`, color: "secondary" as const };
  return { label: `${d}d`, color: "default" as const };
}

export default function PcpValidadesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unidadeFiltro, setUnidadeFiltro] = useState("");
  const [descarteItem, setDescarteItem] = useState<any | null>(null);
  const [descarteQtd, setDescarteQtd] = useState("");
  const [descarteMotivo, setDescarteMotivo] = useState("");
  const [etiquetaItem, setEtiquetaItem] = useState<any | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["pcp-validades-list"],
    queryFn: async () => {
      const { data } = await supabase.from("pcp_validades").select("*").order("data_validade", { ascending: true }).limit(500);
      return data ?? [];
    },
  });

  const filtered = useMemo(() =>
    items.filter((i: any) => !unidadeFiltro || i.unidade === unidadeFiltro),
  [items, unidadeFiltro]);

  const descarteMut = useMutation({
    mutationFn: async () => {
      if (!descarteItem) return;
      const novaQtd = Math.max(0, (+descarteItem.quantidade_kg || 0) - (+descarteQtd || 0));
      const { error } = await supabase.from("pcp_validades").update({
        status: "descartado", quantidade_kg: novaQtd,
      }).eq("id", descarteItem.id);
      if (error) throw error;
      await supabase.from("pcp_producao").insert({
        data: new Date().toISOString().slice(0, 10),
        produto: descarteItem.produto, unidade: descarteItem.unidade,
        quantidade_descartada_kg: +descarteQtd, observacoes: `Descarte: ${descarteMotivo}`, user_id: user?.id,
      } as any);
    },
    onSuccess: () => {
      toast.success("Descarte registrado");
      qc.invalidateQueries({ queryKey: ["pcp-validades-list"] });
      setDescarteItem(null); setDescarteQtd(""); setDescarteMotivo("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  function imprimir(item: any) {
    const html = `<html><head><title>Etiqueta ${item.produto}</title>
      <style>body{font-family:Arial;padding:20px;max-width:380px}
      .label{border:2px solid #000;padding:14px;border-radius:8px}
      h2{margin:0 0 8px 0;font-size:18px;text-transform:uppercase}
      .row{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
      .row b{font-weight:700} .qty{font-size:22px;text-align:center;margin:10px 0;padding:8px;background:#f0f0f0;border-radius:6px}
      @media print{@page{size:80mm 60mm;margin:4mm}}
      </style></head><body>
      <div class="label">
        <h2>${item.produto || "-"}</h2>
        <div class="row"><b>Lote:</b><span>${item.lote || "—"}</span></div>
        <div class="row"><b>Unidade:</b><span>${item.unidade || "—"}</span></div>
        <div class="row"><b>Produção:</b><span>${item.data_producao ? formatDate(item.data_producao) : "—"}</span></div>
        <div class="row"><b>Validade:</b><span>${item.data_validade ? formatDate(item.data_validade) : "—"}</span></div>
        <div class="qty">${(+item.quantidade_kg || 0).toFixed(3)} kg</div>
      </div>
      <script>window.print()</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Validades — alertas e descarte
            <Select value={unidadeFiltro || "all"} onValueChange={v => setUnidadeFiltro(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48 h-8 font-normal"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem itens.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Qtd (kg)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i: any) => {
                  const d = i.data_validade ? diasParaVencer(i.data_validade) : 999;
                  const s = statusByDays(d);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.produto}</TableCell>
                      <TableCell className="text-xs">{i.lote || "—"}</TableCell>
                      <TableCell className="text-xs">{i.unidade}</TableCell>
                      <TableCell className="text-xs">{i.data_validade ? formatDate(i.data_validade) : "—"}</TableCell>
                      <TableCell>{(+i.quantidade_kg || 0).toFixed(3)}</TableCell>
                      <TableCell>
                        {i.status === "descartado"
                          ? <Badge variant="outline">Descartado</Badge>
                          : <Badge variant={s.color}>{s.label}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => imprimir(i)} title="Imprimir etiqueta">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setDescarteItem(i); setDescarteQtd(String(i.quantidade_kg || "")); }} title="Registrar descarte">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PcpCrudTab config={validadesConfig} />

      <Dialog open={!!descarteItem} onOpenChange={o => !o && setDescarteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar descarte — {descarteItem?.produto}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantidade (kg)</Label>
              <Input type="number" step="0.001" value={descarteQtd} onChange={e => setDescarteQtd(e.target.value)} /></div>
            <div><Label>Motivo</Label>
              <Textarea value={descarteMotivo} onChange={e => setDescarteMotivo(e.target.value)} placeholder="Vencimento, dano, contaminação..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescarteItem(null)}>Cancelar</Button>
            <Button onClick={() => descarteMut.mutate()} disabled={descarteMut.isPending || !descarteQtd}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
