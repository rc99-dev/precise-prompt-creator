import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

type Product = {
  id: string; nome: string; codigo_interno: string | null; categoria: string | null;
  unidade_medida: string; marca: string | null; descricao: string | null; status: string;
};

const UNIDADES = ["kg", "g", "litro", "ml", "unidade", "caixa", "pacote", "saco", "dúzia", "metro"];
const emptyProduct = { nome: "", codigo_interno: "", categoria: "", unidade_medida: "unidade", marca: "", descricao: "", status: "ativo" };

export default function ProductsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    let query = supabase.from('products').select('*').order('nome');
    if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
    const { data } = await query;
    setProducts(data || []);
  };

  useEffect(() => { fetchProducts(); }, [statusFilter]);

  const filtered = products.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo_interno || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm(emptyProduct); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      nome: p.nome, codigo_interno: p.codigo_interno || "", categoria: p.categoria || "",
      unidade_medida: p.unidade_medida, marca: p.marca || "", descricao: p.descricao || "", status: p.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (editing) {
      const { error } = await supabase.from('products').update(form).eq('id', editing.id);
      if (error) toast.error(error.message); else toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from('products').insert(form);
      if (error) toast.error(error.message); else toast.success("Produto cadastrado!");
    }
    setLoading(false); setDialogOpen(false); fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este produto?")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success("Produto excluído!"); fetchProducts(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro de produtos</p>
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, código ou categoria..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Unidade</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  {isAdmin && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{p.nome}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.codigo_interno || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.categoria || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{p.unidade_medida}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'}>{p.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Código Interno</Label>
                <Input value={form.codigo_interno} onChange={e => setForm({...form, codigo_interno: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={v => setForm({...form, unidade_medida: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
