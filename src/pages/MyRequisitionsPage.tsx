import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ClipboardList } from "lucide-react";
import { formatDate, statusLabels } from "@/lib/helpers";
import { UNIDADES, SETORES } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type Requisition = {
  id: string; user_id: string; product_id: string; saldo_atual: number;
  unidade_medida: string; unidade_setor: string | null; unidade: string | null;
  setor: string | null; observacoes: string | null;
  status: string; motivo_recusa: string | null; created_at: string;
  products?: { nome: string } | null;
};

type Product = { id: string; nome: string; unidade_medida: string };

export default function MyRequisitionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ product_id: "", saldo_atual: "", unidade: "", setor: "", observacoes: "" });
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-requisitions', user?.id],
    queryFn: async () => {
      const [{ data: reqs, error: e1 }, { data: prods, error: e2 }] = await Promise.all([
        supabase.from('requisitions').select('*, products(nome)').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('products').select('id, nome, unidade_medida').eq('status', 'ativo').order('nome'),
      ]);
      if (e1 || e2) throw new Error("Erro ao carregar dados");
      return { requisitions: (reqs || []) as unknown as Requisition[], products: (prods || []) as Product[] };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds instead of 5 minutes for faster updates
  });

  const requisitions = data?.requisitions || [];
  const products = data?.products || [];
  const selectedProduct = products.find(p => p.id === form.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) { toast.error("Selecione um produto."); return; }
    setSaving(true);
    const { error } = await supabase.from('requisitions').insert({
      user_id: user!.id, product_id: form.product_id,
      saldo_atual: parseFloat(form.saldo_atual) || 0,
      unidade_medida: selectedProduct?.unidade_medida || 'unidade',
      unidade: form.unidade || null,
      setor: form.setor || null,
      unidade_setor: form.setor ? `${form.unidade} - ${form.setor}` : form.unidade || null,
      observacoes: form.observacoes || null,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Solicitação enviada!");
      setForm({ product_id: "", saldo_atual: "", unidade: "", setor: "", observacoes: "" });
      setShowForm(false);
      // Invalidate all requisition-related queries immediately
      queryClient.invalidateQueries({ queryKey: ['my-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['requisitions-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requisitions-for-comp'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
    setSaving(false);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pendente: 'bg-warning/20 text-warning',
      incluida_no_pedido: 'bg-success/20 text-success',
      recusada: 'bg-destructive/20 text-destructive',
    };
    return <Badge className={colors[status] || ''}>{statusLabels[status] || status}</Badge>;
  };

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Minhas Solicitações</h1>
          <p className="text-muted-foreground text-sm mt-1">Informe o saldo dos produtos que precisa</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />Nova Solicitação
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Nova Solicitação</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produto *</Label>
                  <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
                      </div>
                      {filteredProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Saldo Atual *</Label>
                  <Input type="number" step="0.01" min="0" value={form.saldo_atual}
                    onChange={e => setForm({ ...form, saldo_atual: e.target.value })} required
                    placeholder="Quantidade em estoque" />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">Unidade: {selectedProduct.unidade_medida}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border">
                  <CardHeader className="py-2 px-4"><CardTitle className="text-sm">Unidade</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <Select value={form.unidade} onValueChange={v => setForm({ ...form, unidade: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardHeader className="py-2 px-4"><CardTitle className="text-sm">Setor</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <Select value={form.setor} onValueChange={v => setForm({ ...form, setor: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>
                        {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observação opcional..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar Solicitação"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton columns={6} rows={5} />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : requisitions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Nenhuma solicitação ainda</p>
              <p className="text-xs mt-1">Clique em "Nova Solicitação" para informar o saldo de um produto</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Saldo Atual</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{r.products?.nome || '—'}</td>
                      <td className="py-3 px-4 text-right currency">{r.saldo_atual} {r.unidade_medida}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{(r as any).unidade || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{(r as any).setor || r.unidade_setor || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDate(r.created_at)}</td>
                      <td className="py-3 px-4 text-center">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {requisitions.some(r => r.status === 'recusada' && r.motivo_recusa) && (
        <Card>
          <CardHeader><CardTitle className="text-lg text-destructive">Solicitações Recusadas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {requisitions.filter(r => r.status === 'recusada' && r.motivo_recusa).map(r => (
              <div key={r.id} className="text-sm p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <span className="font-medium">{r.products?.nome}</span>: {r.motivo_recusa}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}