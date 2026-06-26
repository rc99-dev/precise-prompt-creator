import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/helpers";
import { TrendingDown, TrendingUp, Minus, History } from "lucide-react";
import { resolveUserNames } from "@/lib/userNames";

type LinkedPrice = {
  id: string;
  supplier_id: string;
  preco_unitario: number;
  prazo_entrega: string | null;
  updated_at: string;
  suppliers: { razao_social: string } | null;
};

type HistoryRow = {
  id: string;
  supplier_price_id: string;
  preco_anterior: number;
  preco_novo: number;
  changed_at: string;
  changed_by: string | null;
  supplier_id: string;
  supplier_name: string;
  changed_by_name?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string;
}

export default function ProductPriceHistoryDialog({ open, onOpenChange, productId, productName }: Props) {
  const [linked, setLinked] = useState<LinkedPrice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("todos");

  useEffect(() => {
    if (!open || !productId) {
      setLinked([]);
      setHistory([]);
      setSupplierFilter("todos");
      return;
    }
    (async () => {
      setLoading(true);
      const { data: prices } = await supabase
        .from("supplier_prices")
        .select("id, supplier_id, preco_unitario, prazo_entrega, updated_at, suppliers(razao_social)")
        .eq("product_id", productId)
        .order("preco_unitario", { ascending: true });

      const linkedRows = (prices || []) as unknown as LinkedPrice[];
      setLinked(linkedRows);

      const priceIds = linkedRows.map((p) => p.id);
      if (priceIds.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const { data: histRows } = await supabase
        .from("price_history")
        .select("id, supplier_price_id, preco_anterior, preco_novo, changed_at, changed_by")
        .in("supplier_price_id", priceIds)
        .order("changed_at", { ascending: false });

      const supplierBySpId: Record<string, { id: string; name: string }> = {};
      linkedRows.forEach((p) => {
        supplierBySpId[p.id] = { id: p.supplier_id, name: p.suppliers?.razao_social || "—" };
      });

      const userIds = Array.from(new Set((histRows || []).map((h: any) => h.changed_by).filter(Boolean))) as string[];
      const nameMap = userIds.length ? await resolveUserNames(userIds) : {};

      const mapped: HistoryRow[] = (histRows || []).map((h: any) => ({
        id: h.id,
        supplier_price_id: h.supplier_price_id,
        preco_anterior: Number(h.preco_anterior),
        preco_novo: Number(h.preco_novo),
        changed_at: h.changed_at,
        changed_by: h.changed_by,
        supplier_id: supplierBySpId[h.supplier_price_id]?.id || "",
        supplier_name: supplierBySpId[h.supplier_price_id]?.name || "—",
        changed_by_name: h.changed_by ? nameMap[h.changed_by] || "Usuário" : "—",
      }));
      setHistory(mapped);
      setLoading(false);
    })();
  }, [open, productId]);

  const suppliers = useMemo(() => {
    const m = new Map<string, string>();
    linked.forEach((l) => m.set(l.supplier_id, l.suppliers?.razao_social || "—"));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [linked]);

  const filteredLinked = supplierFilter === "todos" ? linked : linked.filter((l) => l.supplier_id === supplierFilter);
  const filteredHistory = supplierFilter === "todos" ? history : history.filter((h) => h.supplier_id === supplierFilter);

  const minPrice = linked.length ? Math.min(...linked.map((l) => l.preco_unitario)) : null;

  const trendIcon = (anterior: number, novo: number) => {
    if (novo > anterior) return <TrendingUp className="h-3.5 w-3.5 text-destructive" />;
    if (novo < anterior) return <TrendingDown className="h-3.5 w-3.5 text-success" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const percent = (anterior: number, novo: number) => {
    if (!anterior) return null;
    const p = ((novo - anterior) / anterior) * 100;
    const sign = p > 0 ? "+" : "";
    return `${sign}${p.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Preços — {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filtrar por fornecedor:</span>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os fornecedores</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <section>
            <h3 className="text-sm font-semibold mb-2">Fornecedores vinculados e preços atuais</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground py-3">Carregando…</p>
            ) : filteredLinked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">Nenhum vínculo de fornecedor para este produto.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fornecedor</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Preço atual</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Prazo</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Atualizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLinked.map((l) => {
                      const isMin = minPrice !== null && l.preco_unitario === minPrice;
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="py-2 px-3 font-medium">{l.suppliers?.razao_social || "—"}</td>
                          <td className="py-2 px-3 text-right currency">
                            <span className={isMin ? "text-success font-semibold" : ""}>{formatCurrency(l.preco_unitario)}</span>
                            {isMin && <Badge className="ml-2 bg-success/15 text-success text-[10px]">menor</Badge>}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{l.prazo_entrega || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{formatDateTime(l.updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Linha do tempo — atualizações de preço</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground py-3">Carregando…</p>
            ) : filteredHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">Nenhuma atualização de preço registrada ainda.</p>
            ) : (
              <ol className="relative border-l border-border pl-5 space-y-3">
                {filteredHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                    <div className="rounded-md border bg-card px-3 py-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          {trendIcon(h.preco_anterior, h.preco_novo)}
                          <span className="font-medium">{h.supplier_name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="currency text-muted-foreground line-through">
                            {formatCurrency(h.preco_anterior)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="currency font-semibold">{formatCurrency(h.preco_novo)}</span>
                          {percent(h.preco_anterior, h.preco_novo) && (
                            <Badge
                              className={
                                h.preco_novo > h.preco_anterior
                                  ? "bg-destructive/15 text-destructive text-[10px]"
                                  : h.preco_novo < h.preco_anterior
                                  ? "bg-success/15 text-success text-[10px]"
                                  : "bg-muted text-muted-foreground text-[10px]"
                              }
                            >
                              {percent(h.preco_anterior, h.preco_novo)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(h.changed_at)} · por {h.changed_by_name}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
