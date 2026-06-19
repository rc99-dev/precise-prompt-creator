import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

function ms(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10);
}

export default function PcpRelatoriosPage() {
  const [start, setStart] = useState(ms());
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["pcp-relatorios", start, end],
    queryFn: async () => {
      const [compras, rendimento, producao, distribuicao, rateio, reembolsos] = await Promise.all([
        supabase.from("pcp_compras").select("*").gte("data", start).lte("data", end),
        supabase.from("pcp_rendimento").select("*").gte("data", start).lte("data", end),
        supabase.from("pcp_producao").select("*").gte("data", start).lte("data", end),
        supabase.from("pcp_distribuicao").select("*").gte("data", start).lte("data", end),
        supabase.from("pcp_rateio").select("*").gte("data_ref", start).lte("data_ref", end),
        supabase.from("pcp_reembolsos").select("*").gte("data_ref", start).lte("data_ref", end),
      ]);
      return {
        compras: compras.data ?? [], rendimento: rendimento.data ?? [],
        producao: producao.data ?? [], distribuicao: distribuicao.data ?? [],
        rateio: rateio.data ?? [], reembolsos: reembolsos.data ?? [],
      };
    },
  });

  const totalCompras = (data?.compras ?? []).reduce((s, r: any) => s + (+r.custo_geral || 0), 0);
  const kgComprado = (data?.compras ?? []).reduce((s, r: any) => s + (+r.peso_bruto_kg || 0), 0);
  const cmvTotal = (data?.producao ?? []).reduce((s, r: any) => s + (+r.cmv_total || 0), 0);
  const distKg = (data?.distribuicao ?? []).reduce((s, r: any) => s + (+r.quantidade_kg || 0), 0);

  const rendByForn: Record<string, number[]> = {};
  (data?.rendimento ?? []).forEach((r: any) => {
    if (r.pct_rendimento == null || !r.fornecedor) return;
    rendByForn[r.fornecedor] ??= [];
    rendByForn[r.fornecedor].push(+r.pct_rendimento);
  });
  const rankForn = Object.entries(rendByForn).map(([f, a]) => ({ f, media: a.reduce((x, y) => x + y, 0) / a.length, n: a.length }))
    .sort((a, b) => b.media - a.media);

  const distByUnit: Record<string, number> = {};
  (data?.distribuicao ?? []).forEach((d: any) => {
    distByUnit[d.unidade_destino || "—"] = (distByUnit[d.unidade_destino || "—"] || 0) + (+d.quantidade_kg || 0);
  });

  const rateioPendentes = (data?.rateio ?? []).filter((r: any) => !r.enviou_rateio).length;
  const reembolsosPendentes = (data?.reembolsos ?? []).filter((r: any) => !r.enviou_rateio).length;

  function exportarPdf() {
    const html = `<html><head><title>Relatório PCP — ${start} a ${end}</title>
      <style>body{font-family:Arial;max-width:780px;margin:auto;padding:24px;color:#111}
      h1{margin:0 0 4px 0;color:#5c1b43} h2{margin-top:28px;border-bottom:2px solid #5c1b43;padding-bottom:4px;color:#5c1b43}
      .meta{color:#666;margin-bottom:20px;font-size:13px}
      table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#f5f5f5} .kpi{display:inline-block;margin:4px 12px 4px 0;padding:8px 12px;background:#f9f0f5;border-radius:6px}
      .kpi b{display:block;font-size:18px;color:#5c1b43}
      @media print{body{padding:8mm}}
      </style></head><body>
      <h1>Relatório PCP</h1>
      <div class="meta">Período: ${formatDate(start)} a ${formatDate(end)}</div>

      <h2>Resumo Executivo</h2>
      <div>
        <div class="kpi">Compras<b>${formatCurrency(totalCompras)}</b></div>
        <div class="kpi">Kg comprado<b>${kgComprado.toFixed(1)} kg</b></div>
        <div class="kpi">CMV<b>${formatCurrency(cmvTotal)}</b></div>
        <div class="kpi">Distribuído<b>${distKg.toFixed(1)} kg</b></div>
        <div class="kpi">Rateios pendentes<b>${rateioPendentes}</b></div>
        <div class="kpi">Reembolsos pendentes<b>${reembolsosPendentes}</b></div>
      </div>

      <h2>Ranking de Fornecedores por Rendimento</h2>
      <table><thead><tr><th>#</th><th>Fornecedor</th><th>Rendimento médio</th><th>Lotes</th></tr></thead>
      <tbody>${rankForn.slice(0, 15).map((r, i) => `<tr><td>${i + 1}</td><td>${r.f}</td><td>${r.media.toFixed(2)}%</td><td>${r.n}</td></tr>`).join("") || '<tr><td colspan="4">—</td></tr>'}</tbody></table>

      <h2>Distribuição por Unidade</h2>
      <table><thead><tr><th>Unidade</th><th>Quantidade (kg)</th></tr></thead>
      <tbody>${Object.entries(distByUnit).map(([u, k]) => `<tr><td>${u}</td><td>${k.toFixed(1)}</td></tr>`).join("") || '<tr><td colspan="2">—</td></tr>'}</tbody></table>

      <h2>Pendências</h2>
      <p>Rateios pendentes: <b>${rateioPendentes}</b></p>
      <p>Reembolsos pendentes: <b>${reembolsosPendentes}</b></p>

      <script>window.print()</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para exportar"); return; }
    w.document.write(html); w.document.close();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros e exportação</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>De</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
            <Button onClick={exportarPdf} className="gap-2"><FileDown className="h-4 w-4" /> Exportar PDF</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Compras</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{formatCurrency(totalCompras)}</div><p className="text-xs text-muted-foreground">{kgComprado.toFixed(1)} kg</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">CMV total</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{formatCurrency(cmvTotal)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Distribuído</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{distKg.toFixed(1)} kg</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Fornecedores avaliados</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{rankForn.length}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Rateios pendentes</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-warning">{rateioPendentes}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs text-muted-foreground">Reembolsos pendentes</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-warning">{reembolsosPendentes}</div></CardContent></Card>
        </div>
      )}
    </div>
  );
}
