import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, X, ClipboardList, ShoppingCart, Eye } from "lucide-react";
import { formatDate, statusLabels } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type ReqItem = {
  id: string; product_id: string; saldo: number;
  products?: { nome: string; unidade_medida: string } | null;
};

type Requisition = {
  id: string; user_id: string; titulo: string | null; unidade: string | null;
  setor: string | null; status: string; created_at: string;
  profiles?: { full_name: string } | null;
  requisition_items?: ReqItem[];
};

export default function RequisitionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [search, setSearch] = useState("");
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailReq, setDetailReq] = useState<Requisition | null>(null);

  const { data: requisitions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['requisitions-list', statusFilter],
    queryFn: async () => {
      let query = supabase.from('requisitions')
        .select('id, user_id, titulo, unidade, setor, status, created_at')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;

      const reqs = data || [];
      // Load profiles and items
      const userIds = [...new Set(reqs.map(r => r.user_id))];
      const reqIds = reqs.map(r => r.id);

      const [{ data: profiles }, { data: items }] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : { data: [] },
        reqIds.length > 0 ? supabase.from('requisition_items').select('id, requisition_id, product_id, saldo, products(nome, unidade_medida)').in('requisition_id', reqIds) : { data: [] },
      ]);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });

      return reqs.map((r: any) => ({
        ...r,
        profiles: { full_name: profileMap[r.user_id] || '—' },
        requisition_items: (items || []).filter((i: any) => i.requisition_id === r.id),
      })) as Requisition[];
    },
    staleTime: 30 * 1000,
  });

  const filtered = requisitions.filter(r =>
    (r.titulo || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleInclude = (reqId: string) => {
    navigate(`/nova-ordem?requisition=${reqId}`);
  };

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) { toast.error("Informe o motivo da recusa."); return; }
    const { error } = await supabase.from('requisitions').update({
      status: 'recusada', motivo_recusa: rejectReason,
    } as any).eq('id', rejectDialog);
    if (error) toast.error(error.message);
    else {
      toast.success("Solicitação recusada.");
      setRejectDialog(null); setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ['requisitions-list'] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie solicitações dos setores</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título ou solicitante..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="incluida_no_pedido">Incluídas</SelectItem>
            <SelectItem value="recusada">Recusadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma solicitação {statusFilter !== 'todos' ? statusLabels[statusFilter]?.toLowerCase() : ''} encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Título</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Solicitante</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Itens</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                    {statusFilter === 'pendente' && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{r.titulo || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{r.profiles?.full_name || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{r.unidade || '—'}</td>
                      <td className="py-3 px-4 text-center">{r.requisition_items?.length || 0}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDate(r.created_at)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={r.status === 'pendente' ? 'bg-warning/20 text-warning' : r.status === 'recusada' ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}>
                          {statusLabels[r.status] || r.status}
                        </Badge>
                      </td>
                      {statusFilter === 'pendente' && (
                        <td className="py-3 px-4 text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setDetailReq(r)} title="Ver itens">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleInclude(r.id)}>
                            <ShoppingCart className="h-3 w-3 mr-1" />Incluir
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejectDialog(r.id)}>
                            <X className="h-3 w-3 mr-1" />Recusar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailReq} onOpenChange={() => setDetailReq(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailReq?.titulo || 'Solicitação'}</DialogTitle></DialogHeader>
          {detailReq && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Solicitante:</span> {detailReq.profiles?.full_name}</div>
                <div><span className="text-muted-foreground">Unidade:</span> {detailReq.unidade}</div>
                <div><span className="text-muted-foreground">Setor:</span> {detailReq.setor}</div>
                <div><span className="text-muted-foreground">Data:</span> {formatDate(detailReq.created_at)}</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Unidade</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailReq.requisition_items || []).map(i => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="py-2">{(i.products as any)?.nome || '—'}</td>
                      <td className="py-2 text-muted-foreground">{(i.products as any)?.unidade_medida || '—'}</td>
                      <td className="py-2 text-right">{i.saldo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo da recusa *</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Informe o motivo..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject}>Recusar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
