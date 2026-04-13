import { useState, useEffect } from "react";
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
import { Plus, ClipboardList, X, Search } from "lucide-react";
import { formatDate, statusLabels } from "@/lib/helpers";
import { UNIDADES, SETORES, TITULOS_SOLICITACAO } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type Requisition = {
  id: string; user_id: string; titulo: string | null; unidade: string | null;
  setor: string | null; status: string; motivo_recusa: string | null; created_at: string;
  requisition_items?: { id: string; product_id: string; saldo: number; pedido: number; observacoes: string | null; products?: { nome: string; unidade_medida: string } | null }[];
};

type Product = { id: string; nome: string; unidade_medida: string; categoria: string | null };

type DraftItem = { product_id: string; nome: string; unidade_medida: string; saldo: string; pedido: string; observacoes: string };

export default function MyRequisitionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-requisitions', user?.id],
    queryFn: async () => {
      const [{ data: reqs, error: e1 }, { data: prods, error: e2 }, { data: cats, error: e3 }] = await Promise.all([
        supabase.from('requisitions').select('id, user_id, titulo, unidade, setor, status, motivo_recusa, created_at, observacoes')
          .eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('products').select('id, nome, unidade_medida, categoria').eq('status', 'ativo').order('nome'),
        supabase.from('product_categories').select('nome').order('nome'),
      ]);
      if (e1 || e2 || e3) throw new Error("Erro ao carregar dados");

      const reqIds = (reqs || []).map(r => r.id);
      let reqItems: any[] = [];
      if (reqIds.length > 0) {
        const { data: ri } = await supabase.from('requisition_items')
          .select('id, requisition_id, product_id, saldo, pedido, observacoes, products(nome, unidade_medida)')
          .in('requisition_id', reqIds);
        reqItems = ri || [];
      }

      const enriched = (reqs || []).map((r: any) => ({
        ...r,
        requisition_items: reqItems.filter(ri => ri.requisition_id === r.id),
      }));

      return {
        requisitions: enriched as Requisition[],
        products: (prods || []) as Product[],
        categories: (cats || []).map((c: any) => c.nome as string),
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const requisitions = data?.requisitions || [];
  const products = data?.products || [];
  const categories = data?.categories || [];

  // Handle edit param — load existing requisition data
  useEffect(() => {
    if (!editId || !data) return;
    const req = requisitions.find(r => r.id === editId);
    if (!req) {
      // Requisition might belong to another user — try fetching it
      (async () => {
        const { data: reqData } = await supabase.from('requisitions')
          .select('id, titulo, unidade, setor, observacoes')
          .eq('id', editId).single();
        const { data: reqItems } = await supabase.from('requisition_items')
          .select('product_id, saldo, pedido, observacoes, products(nome, unidade_medida)')
          .eq('requisition_id', editId);
        if (reqData) {
          loadReqIntoForm(reqData, reqItems || []);
        }
      })();
    } else {
      loadReqIntoForm(req, req.requisition_items || []);
    }
    // Clear edit param from URL
    setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, data]);

  const loadReqIntoForm = (req: any, reqItems: any[]) => {
    setEditingId(req.id);
    setTitulo(req.titulo || "");
    setUnidade(req.unidade || "");
    setSetor(req.setor || "");
    setObservacoes(req.observacoes || "");
    setItems(reqItems.map((i: any) => ({
      product_id: i.product_id,
      nome: i.products?.nome || '—',
      unidade_medida: i.products?.unidade_medida || '',
      saldo: String(i.saldo || ''),
      pedido: String(i.pedido || ''),
      observacoes: i.observacoes || '',
    })));
    setShowForm(true);
  };

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(productSearch.toLowerCase()) &&
    !items.some(i => i.product_id === p.id)
  );

  const handleCategoryChange = (cat: string) => {
    setCategoria(cat);
    if (!cat) return;
    const catProducts = products.filter(p => p.categoria === cat && !items.some(i => i.product_id === p.id));
    if (catProducts.length > 0) {
      setItems(prev => [
        ...prev,
        ...catProducts.map(p => ({
          product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida,
          saldo: "", pedido: "", observacoes: "",
        })),
      ]);
    }
  };

  const addProduct = (p: Product) => {
    setItems([...items, { product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida, saldo: "", pedido: "", observacoes: "" }]);
    setProductSearch("");
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateField = (idx: number, field: keyof DraftItem, val: string) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: val };
    setItems(copy);
  };

  const resetForm = () => {
    setTitulo(""); setUnidade(""); setSetor(""); setCategoria(""); setObservacoes(""); setItems([]);
    setShowForm(false); setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo) { toast.error("Selecione o título."); return; }
    if (!unidade) { toast.error("Selecione a unidade."); return; }
    if (!setor) { toast.error("Selecione o setor."); return; }
    if (items.length === 0) { toast.error("Adicione pelo menos um produto."); return; }

    setSaving(true);

    if (editingId) {
      // Update existing requisition
      const { error } = await supabase.from('requisitions').update({
        titulo, unidade, setor, unidade_setor: `${unidade} - ${setor}`,
        observacoes: observacoes || null,
        product_id: items[0].product_id,
        saldo_atual: parseFloat(items[0].saldo) || 0,
        unidade_medida: items[0].unidade_medida,
      } as any).eq('id', editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Delete old items and re-insert
      await supabase.from('requisition_items').delete().eq('requisition_id', editingId);
      const itemsToInsert = items.map(i => ({
        requisition_id: editingId,
        product_id: i.product_id,
        saldo: parseFloat(i.saldo) || 0,
        pedido: parseFloat(i.pedido) || 0,
        observacoes: i.observacoes || null,
      }));
      await supabase.from('requisition_items').insert(itemsToInsert);

      toast.success("Solicitação atualizada!");
    } else {
      // Create new requisition
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).single();

      const { data: req, error } = await supabase.from('requisitions').insert({
        user_id: user!.id,
        titulo, unidade, setor,
        unidade_setor: `${unidade} - ${setor}`,
        product_id: items[0].product_id,
        saldo_atual: parseFloat(items[0].saldo) || 0,
        unidade_medida: items[0].unidade_medida,
        observacoes: observacoes || null,
      } as any).select('id').single();

      if (error || !req) { toast.error(error?.message || "Erro ao criar solicitação."); setSaving(false); return; }

      const itemsToInsert = items.map(i => ({
        requisition_id: req.id,
        product_id: i.product_id,
        saldo: parseFloat(i.saldo) || 0,
        pedido: parseFloat(i.pedido) || 0,
        observacoes: i.observacoes || null,
      }));
      await supabase.from('requisition_items').insert(itemsToInsert);

      const { data: buyers } = await supabase.from('user_roles').select('user_id').in('role', ['comprador', 'master']);
      if (buyers?.length) {
        await supabase.from('notifications').insert(buyers.map(b => ({
          user_id: b.user_id,
          titulo: 'Nova solicitação',
          mensagem: `Nova solicitação: ${titulo} — ${unidade} — ${setor} — por ${profile?.full_name || 'Usuário'}`,
          tipo: 'info',
        })));
      }

      toast.success("Solicitação enviada!");
    }

    resetForm();
    queryClient.invalidateQueries({ queryKey: ['my-requisitions'] });
    queryClient.invalidateQueries({ queryKey: ['requisitions-list'] });
    queryClient.invalidateQueries({ queryKey: ['pending-requisitions-for-comp'] });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Minhas Solicitações</h1>
          <p className="text-muted-foreground text-sm mt-1">Informe o saldo dos produtos que precisa</p>
        </div>
        <Button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancelar" : "Nova Solicitação"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{editingId ? "Editar Solicitação" : "Nova Solicitação"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Select value={titulo} onValueChange={setTitulo}>
                    <SelectTrigger><SelectValue placeholder="Selecione o título" /></SelectTrigger>
                    <SelectContent>
                      {TITULOS_SOLICITACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setor *</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>
                      {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-2">
                <Label>Categoria (opcional — carrega produtos automaticamente)</Label>
                <Select value={categoria} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Product search + add */}
              <div className="space-y-2">
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto para adicionar..."
                    className="pl-9"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                {productSearch.length >= 2 && filteredProducts.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between"
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.nome}</span>
                        <span className="text-muted-foreground text-xs">{p.unidade_medida}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items list */}
              {items.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Produto</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-20">Unidade</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground w-28">Saldo</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground w-28">Pedido</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-40">Observações</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.product_id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{item.nome}</td>
                          <td className="py-2 px-3 text-muted-foreground">{item.unidade_medida}</td>
                          <td className="py-2 px-3">
                            <Input
                              type="number" step="0.01" min="0"
                              className="w-24 ml-auto text-right h-8"
                              value={item.saldo}
                              onChange={e => updateField(idx, 'saldo', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number" step="0.01" min="0"
                              className="w-24 ml-auto text-right h-8"
                              value={item.pedido}
                              onChange={e => updateField(idx, 'pedido', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              className="w-36 h-8 text-xs"
                              value={item.observacoes}
                              onChange={e => updateField(idx, 'observacoes', e.target.value)}
                              placeholder="Obs..."
                            />
                          </td>
                          <td className="py-2 px-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observação Geral</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observação opcional..." />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Enviar Solicitação"}</Button>
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
              <p className="text-xs mt-1">Clique em "Nova Solicitação" para informar o saldo dos produtos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Título</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Itens</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{r.titulo || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{r.unidade || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{r.setor || '—'}</td>
                      <td className="py-3 px-4 text-center">{r.requisition_items?.length || 0}</td>
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
                <span className="font-medium">{r.titulo}</span>: {r.motivo_recusa}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
