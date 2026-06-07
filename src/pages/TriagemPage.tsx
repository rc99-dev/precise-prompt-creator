import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, ClipboardList, ShoppingCart, Factory, Eraser } from "lucide-react";
import { formatDate } from "@/lib/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type ReqItem = {
  id: string;
  requisition_id: string;
  product_id: string;
  saldo: number;
  pedido: number;
  observacoes: string | null;
  destino: string | null;
  triagem_em: string | null;
  products?: { nome: string; unidade_medida: string } | null;
};

type Requisition = {
  id: string;
  user_id: string;
  titulo: string | null;
  unidade: string | null;
  setor: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string } | null;
  requisition_items?: ReqItem[];
};

const destinoLabels: Record<string, string> = {
  comprador: "Comprador",
  pcp: "PCP",
};

const destinoColors: Record<string, string> = {
  comprador: "bg-info/20 text-info",
  pcp: "bg-success/20 text-success",
};

export default function TriagemPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [destinoFilter, setDestinoFilter] = useState<string>("todos");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: requisitions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['triagem-list'],
    queryFn: async () => {
      const { data: reqs, error } = await supabase
        .from('requisitions')
        .select('id, user_id, titulo, unidade, setor, status, created_at')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const list = reqs || [];
      const userIds = [...new Set(list.map(r => r.user_id))];
      const reqIds = list.map(r => r.id);

      const [{ data: profiles }, { data: items }] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        reqIds.length > 0
          ? supabase.from('requisition_items')
              .select('id, requisition_id, product_id, saldo, pedido, observacoes, destino, triagem_em, products(nome, unidade_medida)')
              .in('requisition_id', reqIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });

      return list.map((r: any) => ({
        ...r,
        profiles: { full_name: profileMap[r.user_id] || '—' },
        requisition_items: (items || []).filter((i: any) => i.requisition_id === r.id),
      })) as Requisition[];
    },
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return requisitions
      .map(r => {
        const items = (r.requisition_items || []).filter(i => {
          if (destinoFilter === 'sem_destino') return !i.destino;
          if (destinoFilter !== 'todos') return i.destino === destinoFilter;
          return true;
        });
        return { ...r, requisition_items: items };
      })
      .filter(r =>
        (r.requisition_items?.length || 0) > 0 &&
        (
          (r.titulo || '').toLowerCase().includes(term) ||
          (r.profiles?.full_name || '').toLowerCase().includes(term) ||
          (r.unidade || '').toLowerCase().includes(term)
        )
      );
  }, [requisitions, search, destinoFilter]);

  const toggleItem = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedItems(next);
  };

  const toggleReq = (req: Requisition) => {
    const ids = (req.requisition_items || []).map(i => i.id);
    const allSelected = ids.every(id => selectedItems.has(id));
    const next = new Set(selectedItems);
    if (allSelected) ids.forEach(id => next.delete(id));
    else ids.forEach(id => next.add(id));
    setSelectedItems(next);
  };

  const clearSelection = () => setSelectedItems(new Set());

  const assignDestino = async (destino: 'comprador' | 'pcp' | null) => {
    if (selectedItems.size === 0) {
      toast.error("Selecione ao menos um item.");
      return;
    }
    const ids = Array.from(selectedItems);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      destino,
      triagem_em: destino ? new Date().toISOString() : null,
      triagem_por: destino ? user?.id : null,
    };
    const { error } = await supabase.from('requisition_items').update(payload).in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(
      destino
        ? `${ids.length} item(ns) enviados para ${destinoLabels[destino]}.`
        : `${ids.length} item(ns) tiveram a triagem removida.`
    );
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ['triagem-list'] });
  };

  const totalSelected = selectedItems.size;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Triagem de Solicitações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione itens e direcione-os ao <strong>Comprador</strong> ou ao <strong>PCP</strong>.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, solicitante ou unidade..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={destinoFilter} onValueChange={setDestinoFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os itens</SelectItem>
            <SelectItem value="sem_destino">Sem destino</SelectItem>
            <SelectItem value="comprador">Comprador</SelectItem>
            <SelectItem value="pcp">PCP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-0"><TableSkeleton columns={6} rows={6} /></CardContent></Card>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma solicitação pendente encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const items = req.requisition_items || [];
            const allSel = items.length > 0 && items.every(i => selectedItems.has(i.id));
            const someSel = items.some(i => selectedItems.has(i.id));
            return (
              <Card key={req.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allSel}
                        onCheckedChange={() => toggleReq(req)}
                        aria-label="Selecionar todos"
                      />
                      <div>
                        <div className="font-medium text-sm">{req.titulo || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.profiles?.full_name} · {req.unidade || '—'} · {req.setor || '—'} · {formatDate(req.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {items.length} item(ns){someSel && !allSel ? ` · ${items.filter(i => selectedItems.has(i.id)).length} sel.` : ''}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="w-10 py-2 px-3"></th>
                          <th className="text-left py-2 px-3 font-medium">Produto</th>
                          <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Unid.</th>
                          <th className="text-right py-2 px-3 font-medium">Saldo</th>
                          <th className="text-right py-2 px-3 font-medium">Pedido</th>
                          <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Obs.</th>
                          <th className="text-center py-2 px-3 font-medium">Destino</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(i => (
                          <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-3">
                              <Checkbox
                                checked={selectedItems.has(i.id)}
                                onCheckedChange={() => toggleItem(i.id)}
                                aria-label="Selecionar item"
                              />
                            </td>
                            <td className="py-2 px-3">{i.products?.nome || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">{i.products?.unidade_medida || '—'}</td>
                            <td className="py-2 px-3 text-right">{i.saldo}</td>
                            <td className="py-2 px-3 text-right">{i.pedido || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground text-xs hidden md:table-cell">{i.observacoes || '—'}</td>
                            <td className="py-2 px-3 text-center">
                              {i.destino ? (
                                <Badge className={destinoColors[i.destino]}>{destinoLabels[i.destino]}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky action bar */}
      {totalSelected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <strong>{totalSelected}</strong> item(ns) selecionado(s)
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <Eraser className="h-4 w-4 mr-1" /> Limpar
              </Button>
              <Button variant="outline" size="sm" onClick={() => assignDestino(null)}>
                Remover destino
              </Button>
              <Button size="sm" onClick={() => assignDestino('pcp')} className="bg-success text-success-foreground hover:bg-success/90">
                <Factory className="h-4 w-4 mr-1" /> Enviar para PCP
              </Button>
              <Button size="sm" onClick={() => assignDestino('comprador')}>
                <ShoppingCart className="h-4 w-4 mr-1" /> Enviar para Comprador
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
