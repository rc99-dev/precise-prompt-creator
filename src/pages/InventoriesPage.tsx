import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, X, Search, Trash2, Boxes } from "lucide-react";
import { formatDate } from "@/lib/helpers";
import { UNIDADES, SETORES, TITULOS_SOLICITACAO, TITULO_TO_CATEGORIA } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";

type Product = { id: string; nome: string; unidade_medida: string; categoria: string | null };
type DraftItem = { product_id: string; nome: string; unidade_medida: string; saldo: string; observacoes: string };
type Inventory = {
  id: string; titulo: string; categoria: string | null; unidade: string | null;
  setor: string | null; observacoes: string | null; created_at: string; user_id: string;
  itemsCount: number;
};

export default function InventoriesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventories-page'],
    queryFn: async () => {
      const [{ data: invs }, { data: prods }, { data: itemsCount }] = await Promise.all([
        (supabase as any).from('inventories').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, nome, unidade_medida, categoria').eq('status', 'ativo').order('nome'),
        (supabase as any).from('inventory_items').select('inventory_id'),
      ]);
      const counts: Record<string, number> = {};
      (itemsCount || []).forEach((r: any) => { counts[r.inventory_id] = (counts[r.inventory_id] || 0) + 1; });
      const distinctCats = Array.from(new Set((prods || []).map((p: any) => p.categoria).filter(Boolean))).sort() as string[];
      return {
        inventories: ((invs || []) as any[]).map(i => ({ ...i, itemsCount: counts[i.id] || 0 })) as Inventory[],
        products: (prods || []) as Product[],
        categories: distinctCats,
      };
    },
    staleTime: 30 * 1000,
  });

  const inventories = data?.inventories || [];
  const products = data?.products || [];
  const categories = data?.categories || [];

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(productSearch.toLowerCase()) &&
    !items.some(i => i.product_id === p.id)
  );

  const loadCategoryProducts = () => {
    if (!categoria) return;
    const catProducts = products.filter(p => p.categoria === categoria && !items.some(i => i.product_id === p.id));
    if (catProducts.length === 0) { toast.info("Nenhum produto novo nesta categoria."); return; }
    setItems(prev => [
      ...prev,
      ...catProducts.map(p => ({ product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida, saldo: "", observacoes: "" })),
    ]);
    toast.success(`${catProducts.length} produtos carregados`);
  };

  const addProduct = (p: Product) => {
    setItems([...items, { product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida, saldo: "", observacoes: "" }]);
    setProductSearch("");
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateField = (idx: number, field: keyof DraftItem, val: string) => {
    const c = [...items]; c[idx] = { ...c[idx], [field]: val }; setItems(c);
  };
  const resetForm = () => {
    setTitulo(""); setUnidade(""); setSetor(""); setCategoria(""); setObservacoes(""); setItems([]); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo) { toast.error("Selecione o título."); return; }
    const valid = items.filter(i => (parseFloat(i.saldo) || 0) >= 0 && i.product_id);
    if (valid.length === 0) { toast.error("Adicione ao menos um produto."); return; }
    setSaving(true);
    const { data: inv, error } = await (supabase as any).from('inventories').insert({
      user_id: user!.id, titulo, categoria: categoria || null,
      unidade: unidade || null, setor: setor || null, observacoes: observacoes || null,
    }).select('id').single();
    if (error || !inv) { toast.error(error?.message || "Erro"); setSaving(false); return; }
    await (supabase as any).from('inventory_items').insert(valid.map(i => ({
      inventory_id: inv.id, product_id: i.product_id,
      saldo: parseFloat(i.saldo) || 0, observacoes: i.observacoes || null,
    })));
    toast.success("Inventário salvo!");
    resetForm();
    queryClient.invalidateQueries({ queryKey: ['inventories-page'] });
    queryClient.invalidateQueries({ queryKey: ['inventories-for-import'] });
    setSaving(false);
  };

  const deleteInventory = async (id: string) => {
    if (!confirm("Excluir este inventário?")) return;
    const { error } = await (supabase as any).from('inventories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); queryClient.invalidateQueries({ queryKey: ['inventories-page'] }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventários</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre saldos de produtos para reaproveitar em solicitações</p>
        </div>
        <Button onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancelar" : "Novo Inventário"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Novo Inventário</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Select value={titulo} onValueChange={(v) => {
                    setTitulo(v);
                    const cat = TITULO_TO_CATEGORIA[v];
                    if (cat && categories.includes(cat)) setCategoria(cat);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TITULOS_SOLICITACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={loadCategoryProducts} disabled={!categoria}>Carregar produtos</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                {productSearch.length >= 2 && filteredProducts.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map(p => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between" onClick={() => addProduct(p)}>
                        <span>{p.nome}</span><span className="text-muted-foreground text-xs">{p.unidade_medida}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {items.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3">Produto</th>
                      <th className="text-left py-2 px-3 w-20">Unidade</th>
                      <th className="text-right py-2 px-3 w-28">Saldo</th>
                      <th className="text-left py-2 px-3 w-40">Observações</th>
                      <th className="w-10"></th>
                    </tr></thead>
                    <tbody>
                      {[...items].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((it) => {
                        const idx = items.findIndex(i => i.product_id === it.product_id);
                        return (
                          <tr key={it.product_id} className="border-b last:border-0">
                            <td className="py-2 px-3 font-medium">{it.nome}</td>
                            <td className="py-2 px-3 text-muted-foreground">{it.unidade_medida}</td>
                            <td className="py-2 px-3"><Input type="number" step="0.01" min="0" className="w-24 ml-auto text-right h-8" value={it.saldo} onChange={e => updateField(idx, 'saldo', e.target.value)} placeholder="0" /></td>
                            <td className="py-2 px-3"><Input className="w-36 h-8 text-xs" value={it.observacoes} onChange={e => updateField(idx, 'observacoes', e.target.value)} placeholder="Obs..." /></td>
                            <td className="py-2 px-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}><X className="h-3 w-3" /></Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar Inventário"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton columns={5} rows={5} /> : inventories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Boxes className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum inventário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Título</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                  <th className="w-12"></th>
                </tr></thead>
                <tbody>
                  {inventories.map(inv => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{inv.titulo}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{inv.categoria || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{inv.unidade || '—'}</td>
                      <td className="py-3 px-4 text-center">{inv.itemsCount}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDate(inv.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        {inv.user_id === user?.id && (
                          <Button size="icon" variant="ghost" onClick={() => deleteInventory(inv.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
