import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileDown, History, Boxes } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/helpers";
import { generateInventoryPDF } from "@/lib/pdfGenerator";
import { resolveUserNames } from "@/lib/userNames";
import { useQuery } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";

const STATUS_BADGE: Record<string, "default"|"secondary"|"outline"> = {
  rascunho: "secondary", enviado: "default", autorizado: "outline",
};

export default function InventoryHistoryPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [logOpen, setLogOpen] = useState<{ inv: any; logs: any[]; nameMap: Record<string,string> } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-history'],
    queryFn: async () => {
      const [{ data: invs }, { data: itemsAll }] = await Promise.all([
        (supabase as any).from('inventories').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('inventory_items').select('inventory_id'),
      ]);
      const counts: Record<string, number> = {};
      (itemsAll || []).forEach((r: any) => { counts[r.inventory_id] = (counts[r.inventory_id] || 0) + 1; });
      const userIds = Array.from(new Set((invs || []).map((i: any) => i.user_id))) as string[];
      const nameMap = userIds.length ? await resolveUserNames(userIds) : {};
      return {
        inventories: ((invs || []) as any[]).map(i => ({ ...i, itemsCount: counts[i.id] || 0 })),
        nameMap,
      };
    },
    staleTime: 30 * 1000,
  });

  const inventories = data?.inventories || [];
  const nameMap = data?.nameMap || {};

  const filtered = inventories.filter((i: any) => {
    const s = search.toLowerCase();
    const matches = !s || i.titulo.toLowerCase().includes(s) || (i.numero || '').toLowerCase().includes(s) || (nameMap[i.user_id] || '').toLowerCase().includes(s);
    const statusOk = statusFilter === 'todos' || i.status === statusFilter;
    return matches && statusOk;
  });

  const exportPDF = async (inv: any) => {
    const [{ data: its }, { data: log }] = await Promise.all([
      (supabase as any).from('inventory_items').select('saldo, observacoes, solicitar_compra, products(nome, unidade_medida)').eq('inventory_id', inv.id),
      (supabase as any).from('inventory_log').select('*').eq('inventory_id', inv.id).order('created_at', { ascending: true }),
    ]);
    const logUserIds = Array.from(new Set((log || []).map((l: any) => l.user_id).filter(Boolean))) as string[];
    const ln = logUserIds.length ? await resolveUserNames(logUserIds) : {};
    generateInventoryPDF({
      numero: inv.numero || inv.id.slice(0, 8),
      titulo: inv.titulo, unidade: inv.unidade, setor: inv.setor, categoria: inv.categoria,
      criado_por: nameMap[inv.user_id] || '—', status: inv.status, created_at: inv.created_at,
      observacoes: inv.observacoes,
      items: (its || []).map((i: any) => ({
        produto: i.products?.nome || '—', unidade: i.products?.unidade_medida || '',
        saldo: Number(i.saldo || 0), observacoes: i.observacoes, solicitar_compra: !!i.solicitar_compra,
      })),
      log: (log || []).map((l: any) => ({
        data: l.created_at, usuario: ln[l.user_id] || '—', acao: l.action, detalhes: l.detalhes,
      })),
    });
  };

  const viewLog = async (inv: any) => {
    const { data: log } = await (supabase as any).from('inventory_log')
      .select('*').eq('inventory_id', inv.id).order('created_at', { ascending: true });
    const ids = Array.from(new Set((log || []).map((l: any) => l.user_id).filter(Boolean))) as string[];
    const nm = ids.length ? await resolveUserNames(ids) : {};
      const missing = ids.filter(id => !nm[id]);
      if (missing.length) {
        const { data: prof } = await supabase.from('profiles').select('user_id, full_name').in('user_id', missing);
        (prof || []).forEach((p: any) => { if (p.full_name) nm[p.user_id] = p.full_name; });
      }
    }
    setLogOpen({ inv, logs: log || [], nameMap: nm });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Inventários</h1>
          <p className="text-muted-foreground text-sm mt-1">Todos os inventários enviados, com log completo de alterações</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/inventarios')}><Boxes className="h-4 w-4 mr-2" />Inventários</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, número ou usuário..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="autorizado">Autorizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton columns={6} rows={5} /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum inventário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Número</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Título</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Usuário</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                </tr></thead>
                <tbody>
                  {filtered.map((inv: any) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-xs">{inv.numero || '—'}</td>
                      <td className="py-3 px-4 font-medium">{inv.titulo}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{inv.unidade}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{nameMap[inv.user_id] || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDate(inv.created_at)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={STATUS_BADGE[inv.status] || 'secondary'}>{inv.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => viewLog(inv)}><History className="h-4 w-4 mr-1" />Log</Button>
                        <Button size="icon" variant="ghost" title="PDF" onClick={() => exportPDF(inv)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!logOpen} onOpenChange={(v) => !v && setLogOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico — {logOpen?.inv?.numero}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {logOpen?.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-2 px-2">Data/Hora</th>
                  <th className="text-left py-2 px-2">Usuário</th>
                  <th className="text-left py-2 px-2">Ação</th>
                  <th className="text-left py-2 px-2">Detalhes</th>
                </tr></thead>
                <tbody>
                  {logOpen?.logs.map((l: any) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{formatDateTime(l.created_at)}</td>
                      <td className="py-2 px-2">{logOpen?.nameMap[l.user_id] || '—'}</td>
                      <td className="py-2 px-2"><Badge variant="outline">{l.action}</Badge></td>
                      <td className="py-2 px-2 text-muted-foreground">{l.detalhes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
