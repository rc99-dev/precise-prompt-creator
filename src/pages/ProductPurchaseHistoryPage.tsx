import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileDown, X, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { UNIDADES } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import { exportBundlePDF, ReportBundle } from "@/lib/reportExports";
import { toast } from "sonner";

const VALID_STATUSES = ["aprovado", "emitido", "recebido", "recebido_com_ocorrencia"];

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string | null };

type PurchaseRow = {
  product_id: string;
  product_nome: string;
  unidade_medida: string | null;
  order_id: string;
  order_numero: string;
  order_data: string;
  order_status: string;
  unidade_setor: string | null;
  supplier_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

async function fetchProducts(): Promise<Product[]> {
  const all: Product[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, nome, codigo_interno, unidade_medida")
      .eq("status", "ativo")
      .order("nome")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...(rows as any));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchPurchases(productIds: string[], dateFrom: string, dateTo: string, unidade: string): Promise<PurchaseRow[]> {
  if (productIds.length === 0) return [];
  // Fetch matching purchase_orders first (apply unidade/date filters here)
  let ordersQuery = supabase
    .from("purchase_orders")
    .select("id, numero, created_at, status, unidade_setor")
    .in("status", VALID_STATUSES);
  if (dateFrom) ordersQuery = ordersQuery.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) ordersQuery = ordersQuery.lte("created_at", `${dateTo}T23:59:59`);
  if (unidade !== "todos") ordersQuery = ordersQuery.eq("unidade_setor", unidade);

  // Paginate orders
  const allOrders: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await ordersQuery.range(from, from + pageSize - 1).order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data || [];
    allOrders.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  if (allOrders.length === 0) return [];
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));
  const orderIds = allOrders.map((o) => o.id);

  // Paginate items in chunks (in() limit safety: chunks of 500 order ids)
  const items: any[] = [];
  for (let i = 0; i < orderIds.length; i += 500) {
    const chunkOrders = orderIds.slice(i, i + 500);
    let pageFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("order_id, product_id, supplier_id, quantidade, preco_unitario, subtotal, products(nome, unidade_medida), suppliers(razao_social)")
        .in("order_id", chunkOrders)
        .in("product_id", productIds)
        .range(pageFrom, pageFrom + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      items.push(...rows);
      if (rows.length < pageSize) break;
      pageFrom += pageSize;
    }
  }

  return items.map((it: any) => {
    const o = orderMap.get(it.order_id);
    return {
      product_id: it.product_id,
      product_nome: it.products?.nome || "—",
      unidade_medida: it.products?.unidade_medida || null,
      order_id: it.order_id,
      order_numero: o?.numero || "—",
      order_data: o?.created_at || "",
      order_status: o?.status || "",
      unidade_setor: o?.unidade_setor || null,
      supplier_nome: it.suppliers?.razao_social || "—",
      quantidade: Number(it.quantidade) || 0,
      preco_unitario: Number(it.preco_unitario) || 0,
      subtotal: Number(it.subtotal) || 0,
    };
  });
}

export default function ProductPurchaseHistoryPage() {
  const [productSearch, setProductSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unidadeFilter, setUnidadeFilter] = useState("todos");

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products-purchase-history"],
    queryFn: fetchProducts,
    staleTime: 60_000,
  });

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productIds = useMemo(() => Array.from(selectedProducts), [selectedProducts]);

  const { data: rows = [], isLoading: loadingRows, refetch, isFetching } = useQuery({
    queryKey: ["product-purchase-history", productIds.sort().join(","), dateFrom, dateTo, unidadeFilter],
    queryFn: () => fetchPurchases(productIds, dateFrom, dateTo, unidadeFilter),
    enabled: productIds.length > 0,
    staleTime: 0,
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 200);
    return products
      .filter((p) => p.nome.toLowerCase().includes(q) || (p.codigo_interno || "").toLowerCase().includes(q))
      .slice(0, 200);
  }, [products, productSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, PurchaseRow[]>();
    rows.forEach((r) => {
      if (!map.has(r.product_id)) map.set(r.product_id, []);
      map.get(r.product_id)!.push(r);
    });
    return map;
  }, [rows]);

  const totalGeral = useMemo(() => rows.reduce((s, r) => s + r.subtotal, 0), [rows]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearProducts = () => setSelectedProducts(new Set());

  const periodLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} a ${formatDate(dateTo)}`;
    if (dateFrom) return `a partir de ${formatDate(dateFrom)}`;
    if (dateTo) return `até ${formatDate(dateTo)}`;
    return "Todo o histórico";
  }, [dateFrom, dateTo]);

  const exportPDF = () => {
    if (rows.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const sections = Array.from(grouped.entries()).map(([pid, items]) => {
      const p = productMap.get(pid);
      const total = items.reduce((s, r) => s + r.subtotal, 0);
      const qty = items.reduce((s, r) => s + r.quantidade, 0);
      return {
        title: `${p?.nome || "Produto"}${p?.codigo_interno ? ` (${p.codigo_interno})` : ""}`,
        periodLabel,
        columns: ["Data", "Ordem", "Unidade", "Fornecedor", "Qtd", "UM", "Preço Unit.", "Subtotal"],
        rows: items
          .slice()
          .sort((a, b) => (a.order_data < b.order_data ? 1 : -1))
          .map((r) => [
            r.order_data ? formatDate(r.order_data) : "—",
            r.order_numero,
            r.unidade_setor || "—",
            r.supplier_nome,
            r.quantidade,
            r.unidade_medida || "—",
            formatCurrency(r.preco_unitario),
            formatCurrency(r.subtotal),
          ]),
        footer: `Qtd total: ${qty}    Total: ${formatCurrency(total)}`,
      };
    });
    const bundle: ReportBundle = {
      title: "Histórico de Compras por Produto",
      periodLabel: `${periodLabel}${unidadeFilter !== "todos" ? ` · ${unidadeFilter}` : ""}`,
      sections,
    };
    exportBundlePDF(bundle);
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Compras por Produto</h1>
          <p className="text-sm text-muted-foreground">Pesquise produtos e veja todas as compras realizadas.</p>
        </div>
        <Button onClick={exportPDF} disabled={rows.length === 0} className="gap-2">
          <FileDown className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs text-muted-foreground">Buscar produto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome ou código do produto"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Unidade</label>
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Período</label>
            <div className="flex gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Produtos ({selectedProducts.size} selecionados)</span>
              {selectedProducts.size > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearProducts}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
            <ScrollArea className="h-[520px] pr-2">
              {loadingProducts ? (
                <div className="text-sm text-muted-foreground p-2">Carregando…</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">Nenhum produto encontrado</div>
              ) : (
                <ul className="space-y-1">
                  {filteredProducts.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleProduct(p.id)}
                    >
                      <Checkbox checked={selectedProducts.has(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.codigo_interno || "—"} · {p.unidade_medida || "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            {selectedProducts.size === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                Selecione pelo menos um produto para ver o histórico de compras.
              </div>
            ) : loadingRows || isFetching ? (
              <TableSkeleton rows={6} />
            ) : rows.length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                Nenhuma compra encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">
                    {rows.length} item(ns) em {grouped.size} produto(s) · Período: {periodLabel}
                  </div>
                  <Badge variant="outline" className="text-base">
                    Total geral: {formatCurrency(totalGeral)}
                  </Badge>
                </div>
                {Array.from(grouped.entries()).map(([pid, items]) => {
                  const p = productMap.get(pid);
                  const totalProd = items.reduce((s, r) => s + r.subtotal, 0);
                  const qtyProd = items.reduce((s, r) => s + r.quantidade, 0);
                  return (
                    <div key={pid} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/40 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-medium">{p?.nome || "Produto"}</div>
                          <div className="text-xs text-muted-foreground">
                            {p?.codigo_interno || "—"} · {items.length} compra(s)
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">Qtd total: <span className="text-foreground font-medium">{qtyProd} {p?.unidade_medida || ""}</span></div>
                          <div className="text-muted-foreground">Total: <span className="text-foreground font-medium">{formatCurrency(totalProd)}</span></div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/20 text-xs text-muted-foreground">
                            <tr>
                              <th className="text-left px-3 py-2">Data</th>
                              <th className="text-left px-3 py-2">Ordem</th>
                              <th className="text-left px-3 py-2">Unidade</th>
                              <th className="text-left px-3 py-2">Fornecedor</th>
                              <th className="text-right px-3 py-2">Qtd</th>
                              <th className="text-right px-3 py-2">Preço Unit.</th>
                              <th className="text-right px-3 py-2">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items
                              .slice()
                              .sort((a, b) => (a.order_data < b.order_data ? 1 : -1))
                              .map((r, idx) => (
                                <tr key={`${r.order_id}-${idx}`} className="border-t border-border/50">
                                  <td className="px-3 py-2 whitespace-nowrap">{r.order_data ? formatDate(r.order_data) : "—"}</td>
                                  <td className="px-3 py-2 font-mono text-xs">{r.order_numero}</td>
                                  <td className="px-3 py-2">{r.unidade_setor || "—"}</td>
                                  <td className="px-3 py-2">{r.supplier_nome}</td>
                                  <td className="px-3 py-2 text-right">{r.quantidade} {r.unidade_medida || ""}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(r.preco_unitario)}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.subtotal)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
