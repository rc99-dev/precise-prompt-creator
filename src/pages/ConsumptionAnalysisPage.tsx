import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATUSES_VALIDAS = ['aguardando_aprovacao', 'aprovado', 'emitido', 'recebido', 'recebido_com_ocorrencia'];

type OrderRow = {
  id: string;
  numero: string;
  titulo: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  unidade_setor: string | null;
};

type ItemRow = {
  order_id: string;
  product_id: string;
  quantidade: number;
  saldo: number | null;
  product_nome: string;
  unidade_medida: string;
};

async function fetchOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, numero, titulo, status, created_at, approved_at, unidade_setor')
    .in('status', STATUSES_VALIDAS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as OrderRow[];
}

async function fetchItemsAndSaldos(orderIds: string[]): Promise<ItemRow[]> {
  if (!orderIds.length) return [];
  const { data: items, error: e1 } = await supabase
    .from('purchase_order_items')
    .select('order_id, product_id, quantidade, products(nome, unidade_medida)')
    .in('order_id', orderIds);
  if (e1) throw e1;

  // Saldos via requisições vinculadas (requisitions.order_id -> requisition_items.saldo)
  const { data: reqs, error: e2 } = await supabase
    .from('requisitions')
    .select('id, order_id')
    .in('order_id', orderIds);
  if (e2) throw e2;

  const reqIds = (reqs || []).map((r: any) => r.id);
  const reqToOrder: Record<string, string> = {};
  (reqs || []).forEach((r: any) => { reqToOrder[r.id] = r.order_id; });

  let saldoMap: Record<string, number> = {}; // key: orderId|productId
  if (reqIds.length) {
    const { data: reqItems, error: e3 } = await supabase
      .from('requisition_items')
      .select('requisition_id, product_id, saldo')
      .in('requisition_id', reqIds);
    if (e3) throw e3;
    (reqItems || []).forEach((ri: any) => {
      const orderId = reqToOrder[ri.requisition_id];
      if (!orderId) return;
      const key = `${orderId}|${ri.product_id}`;
      // soma se houver múltiplas requisições para o mesmo produto/ordem
      saldoMap[key] = (saldoMap[key] ?? 0) + Number(ri.saldo || 0);
    });
  }

  return (items || []).map((it: any) => ({
    order_id: it.order_id,
    product_id: it.product_id,
    quantidade: Number(it.quantidade || 0),
    saldo: saldoMap[`${it.order_id}|${it.product_id}`] ?? null,
    product_nome: it.products?.nome || '—',
    unidade_medida: it.products?.unidade_medida || 'un',
  }));
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export default function ConsumptionAnalysisPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const { data: orders, isLoading } = useQuery({ queryKey: ['consumo-orders'], queryFn: fetchOrders });

  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return orders || [];
    return (orders || []).filter(o =>
      o.numero.toLowerCase().includes(s) ||
      (o.titulo || '').toLowerCase().includes(s) ||
      (o.unidade_setor || '').toLowerCase().includes(s)
    );
  }, [orders, search]);

  const selectedOrders = useMemo(() => {
    return (orders || [])
      .filter(o => selected.has(o.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders, selected]);

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['consumo-items', selectedOrders.map(o => o.id)],
    queryFn: () => fetchItemsAndSaldos(selectedOrders.map(o => o.id)),
    enabled: analyzing && selectedOrders.length >= 2,
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Build analysis matrix: per product, per selected order (in chronological order)
  const analysis = useMemo(() => {
    if (!items || selectedOrders.length < 2) return [];
    const orderIds = selectedOrders.map(o => o.id);

    // group items by product
    const byProduct: Record<string, { nome: string; um: string; perOrder: Record<string, { saldo: number | null; qty: number }> }> = {};
    items.forEach(it => {
      if (!byProduct[it.product_id]) {
        byProduct[it.product_id] = { nome: it.product_nome, um: it.unidade_medida, perOrder: {} };
      }
      const cur = byProduct[it.product_id].perOrder[it.order_id];
      // Se mesmo produto aparecer duas vezes na mesma ordem (não deveria), soma
      byProduct[it.product_id].perOrder[it.order_id] = {
        saldo: it.saldo,
        qty: (cur?.qty || 0) + it.quantidade,
      };
    });

    return Object.entries(byProduct).map(([productId, info]) => {
      const cols = orderIds.map((oid, idx) => {
        const cur = info.perOrder[oid];
        const saldo = cur?.saldo ?? null;
        const qty = cur?.qty ?? 0;
        let saldoInicial: number | null = null;
        let consumo: number | null = null;
        if (saldo !== null) {
          saldoInicial = saldo + qty;
        }
        if (idx > 0) {
          // consumo = (saldo_prev + qty_prev) - saldo_atual
          const prevOid = orderIds[idx - 1];
          const prev = info.perOrder[prevOid];
          if (prev && prev.saldo !== null && saldo !== null) {
            consumo = (prev.saldo + prev.qty) - saldo;
          }
        }
        return { orderId: oid, saldo, qty, saldoInicial, consumo, present: !!cur };
      });
      return { productId, nome: info.nome, um: info.um, cols };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items, selectedOrders]);

  if (analyzing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análise de Consumo</h1>
            <p className="text-sm text-muted-foreground">{selectedOrders.length} ordens selecionadas em ordem cronológica</p>
          </div>
          <Button variant="outline" onClick={() => setAnalyzing(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para seleção
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loadingItems ? (
              <Skeleton className="h-64 w-full" />
            ) : analysis.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">Sem itens para analisar.</div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Produto</TableHead>
                      <TableHead>UM</TableHead>
                      {selectedOrders.map((o, idx) => (
                        <TableHead key={o.id} className="text-center border-l">
                          <div className="font-semibold">{o.numero}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="flex gap-1 justify-center mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <span className="w-14">Saldo</span>
                            <span className="w-14">Pedido</span>
                            {idx === 0 ? (
                              <span className="w-16 text-primary">S. Inicial</span>
                            ) : (
                              <span className="w-16 text-warning">Consumo</span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.map(row => (
                      <TableRow key={row.productId}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.um}</TableCell>
                        {row.cols.map((c, idx) => (
                          <TableCell key={c.orderId} className="border-l text-center">
                            {c.present ? (
                              <div className="flex gap-1 justify-center text-sm tabular-nums">
                                <span className="w-14">{fmt(c.saldo)}</span>
                                <span className="w-14">{fmt(c.qty)}</span>
                                {idx === 0 ? (
                                  <span className="w-16 font-semibold text-primary">{fmt(c.saldoInicial)}</span>
                                ) : (
                                  <span className={`w-16 font-semibold ${c.consumo !== null && c.consumo < 0 ? 'text-destructive' : 'text-warning'}`}>
                                    {fmt(c.consumo)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-sm space-y-1 text-muted-foreground">
            <p><strong className="text-primary">Saldo Inicial</strong> (1ª ordem) = saldo no momento da ordem + quantidade pedida (aprovada).</p>
            <p><strong className="text-warning">Consumo</strong> (ordens seguintes) = (saldo anterior + quantidade comprada anterior) − saldo atual.</p>
            <p>Ordens consideradas: aprovadas, emitidas e recebidas (com alterações do aprovador já contabilizadas).</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Análise de Consumo</h1>
        <p className="text-sm text-muted-foreground">Selecione 2 ou mais ordens para calcular saldo inicial e consumo por produto.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Ordens disponíveis</CardTitle>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Buscar número, título ou setor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Badge variant="secondary">{selected.size} selecionadas</Badge>
            <Button
              onClick={() => setAnalyzing(true)}
              disabled={selected.size < 2}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Analisar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="border rounded-md max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(o => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => toggle(o.id)}
                      data-state={selected.has(o.id) ? 'selected' : undefined}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                      <TableCell>{o.titulo || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.unidade_setor || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrders.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ordem encontrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
