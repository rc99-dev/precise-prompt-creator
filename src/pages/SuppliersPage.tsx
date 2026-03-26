import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

type Supplier = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null;
  contato_principal: string | null; telefone: string | null; whatsapp: string | null;
  email: string | null; endereco: string | null; observacoes: string | null; status: string;
};

const emptySupplier = {
  razao_social: "", nome_fantasia: "", cnpj: "", contato_principal: "",
  telefone: "", whatsapp: "", email: "", endereco: "", observacoes: "", status: "ativo",
};

export default function SuppliersPage() {
  const { role } = useAuth();
  const isAdmin = role === 'master';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptySupplier);
  const [loading, setLoading] = useState(false);

  const fetchSuppliers = async () => {
    let query = supabase.from('suppliers').select('*').order('razao_social');
    if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
    const { data } = await query;
    setSuppliers(data || []);
  };

  useEffect(() => { fetchSuppliers(); }, [statusFilter]);

  const filtered = suppliers.filter(s =>
    s.razao_social.toLowerCase().includes(search.toLowerCase()) ||
    (s.nome_fantasia || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpj || '').includes(search)
  );

  const openNew = () => { setEditing(null); setForm(emptySupplier); setDialogOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      razao_social: s.razao_social, nome_fantasia: s.nome_fantasia || "",
      cnpj: s.cnpj || "", contato_principal: s.contato_principal || "",
      telefone: s.telefone || "", whatsapp: s.whatsapp || "",
      email: s.email || "", endereco: s.endereco || "",
      observacoes: s.observacoes || "", status: s.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (editing) {
      const { error } = await supabase.from('suppliers').update(form).eq('id', editing.id);
      if (error) toast.error(error.message);
      else toast.success("Fornecedor atualizado!");
    } else {
      const { error } = await supabase.from('suppliers').insert(form);
      if (error) toast.error(error.message);
      else toast.success("Fornecedor cadastrado!");
    }
    setLoading(false);
    setDialogOpen(false);
    fetchSuppliers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este fornecedor?")) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success("Fornecedor excluído!"); fetchSuppliers(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus fornecedores</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, fantasia ou CNPJ..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
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
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Razão Social</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Nome Fantasia</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">CNPJ</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Contato</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  {isAdmin && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado.</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{s.razao_social}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{s.nome_fantasia || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{s.cnpj || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{s.contato_principal || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={s.status === 'ativo' ? 'default' : 'secondary'}>{s.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={form.razao_social} onChange={e => setForm({...form, razao_social: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={e => setForm({...form, nome_fantasia: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Contato Principal</Label>
                <Input value={form.contato_principal} onChange={e => setForm({...form, contato_principal: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
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
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} />
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
