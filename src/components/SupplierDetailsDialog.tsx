import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/helpers";

type Props = {
  supplierId: string | null;
  supplierName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type PriceRow = {
  id: string;
  preco_unitario: number;
  unidade_medida: string | null;
  prazo_entrega: string | null;
  quantidade_minima: number | null;
  updated_at: string;
  product_id: string;
  product_nome: string;
};

type HistoryRow = {
  id: string;
  preco_anterior: number;
  preco_novo: number;
  changed_at: string;
};

export default function SupplierDetailsDialog({ supplierId, supplierName, open, onOpenChange }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPrice, setSelectedPrice] = useState<PriceRow | null>(null);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ['supplier-prices-detail', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('supplier_prices')
        .select('id, preco_unitario, unidade_medida, prazo_entrega, quantidade_minima, updated_at, product_id, products(nome)')
        .eq('supplier_id', supplierId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        preco_unitario: Number(p.preco_unitario || 0),
        unidade_medida: p.unidade_medida,
        prazo_entrega: p.prazo_entrega,
        quantidade_minima: p.quantidade_minima ? Number(p.quantidade_minima) : null,
        updated_at: p.updated_at,
        product_id: p.product_id,
        product_nome: p.products?.nome || '—',
      })) as PriceRow[];
    },
    enabled: open && !!supplierId,
  });

  const { data: history = [], isLoading: loadingHist } = useQuery({
    queryKey: ['price-history', selectedPrice?.id],
    queryFn: async () => {
      if (!selectedPrice) return [];
      const { data, error } = await supabase
        .from('price_history')
        .select('id, preco_anterior, preco_novo, changed_at')
        .eq('supplier_price_id', selectedPrice.id)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((h: any) => ({
        id: h.id,
        preco_anterior: Number(h.preco_anterior || 0),
        preco_novo: Number(h.preco_novo || 0),
        changed_at: h.changed_at,
      })) as HistoryRow[];
    },
    enabled: !!selectedPrice,
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return prices;
    return prices.filter(p => p.product_nome.toLowerCase().includes(s));
  }, [prices, search]);

  const handleClose = (v: boolean) => {
    if (!v) setSelectedPrice(null);
    onOpenChange(v);
  };

  // Timeline: includes the current price as "now" entry at top
  const timeline = useMemo(() => {
    if (!selectedPrice) return [];
    const list: { at: string; price: number; prev: number | null; label: string }[] = [];
    list.push({ at: selectedPrice.updated_at, price: selectedPrice.preco_unitario, prev: history[0]?.preco_anterior ?? null, label: 'Preço atual' });
    history.forEach(h => list.push({ at: h.changed_at, price: h.preco_novo, prev: h.preco_anterior, label: 'Alteração' }));
    return list;
  }, [selectedPrice, history]);

  const stats = useMemo(() => {
    if (!selectedPrice || timeline.length === 0) return null;
    const prices = timeline.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[prices.length - 1];
    const last = prices[0];
    const variation = first ? ((last - first) / first) * 100 : 0;
    return { min, max, variation, count: timeline.length };
  }, [timeline, selectedPrice]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedPrice && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedPrice(null)}><ArrowLeft className="h-4 w-4" /></Button>
            )}
            {selectedPrice ? `${selectedPrice.product_nome}` : supplierName}
          </DialogTitle>
        </DialogHeader>

        {!selectedPrice ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar item…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <p className="text-xs text-muted-foreground">{prices.length} item(ns) vinculado(s). Clique em um para ver a linha do tempo de preços.</p>
            {isLoading ? <Skeleton className="h-64 w-full" /> : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhum item vinculado a este fornecedor.</div>
            ) : (
              <div className="border rounded-md max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>UM</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Qtde mín.</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPrice(p)}>
                        <TableCell className="font-medium">{p.product_nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.unidade_medida || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(p.preco_unitario)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{p.quantidade_minima ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.prazo_entrega || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.updated_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {stats && (
              <div className="grid grid-cols-4 gap-2">
                <div className="border rounded-md p-3"><div className="text-[10px] uppercase text-muted-foreground">Atual</div><div className="font-bold tabular-nums">{formatCurrency(selectedPrice.preco_unitario)}</div></div>
                <div className="border rounded-md p-3"><div className="text-[10px] uppercase text-muted-foreground">Mínimo</div><div className="font-bold tabular-nums text-success">{formatCurrency(stats.min)}</div></div>
                <div className="border rounded-md p-3"><div className="text-[10px] uppercase text-muted-foreground">Máximo</div><div className="font-bold tabular-nums text-destructive">{formatCurrency(stats.max)}</div></div>
                <div className="border rounded-md p-3"><div className="text-[10px] uppercase text-muted-foreground">Variação total</div>
                  <div className={`font-bold tabular-nums flex items-center gap-1 ${stats.variation > 0 ? 'text-destructive' : stats.variation < 0 ? 'text-success' : ''}`}>
                    {stats.variation > 0 ? <TrendingUp className="h-3 w-3" /> : stats.variation < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {stats.variation.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3">Linha do tempo</h3>
              {loadingHist ? <Skeleton className="h-32 w-full" /> : timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem histórico.</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-border space-y-4">
                  {timeline.map((t, i) => {
                    const diff = t.prev !== null && t.prev > 0 ? ((t.price - t.prev) / t.prev) * 100 : null;
                    const up = diff !== null && diff > 0;
                    const down = diff !== null && diff < 0;
                    return (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full ring-2 ring-background ${i === 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(t.at)}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-semibold tabular-nums">{formatCurrency(t.price)}</span>
                              {t.prev !== null && (
                                <span className="text-xs text-muted-foreground tabular-nums">de {formatCurrency(t.prev)}</span>
                              )}
                              {diff !== null && (
                                <Badge variant="outline" className={`gap-1 ${up ? 'text-destructive border-destructive/40' : down ? 'text-success border-success/40' : ''}`}>
                                  {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {up ? '+' : ''}{diff.toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          {i === 0 && <Badge variant="secondary" className="text-xs">{t.label}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
