import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, TrendingDown, Upload } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import CsvImportModal from "@/components/CsvImportModal";
import { createPricesImportConfig } from "@/lib/csvConfigs";

type SupplierPrice = {
  id: string; supplier_id: string; product_id: string;
  preco_unitario: number; unidade_medida: string | null;
  quantidade_minima: number | null; prazo_entrega: string | null;
  observacoes: string | null; updated_at: string;
  suppliers: { razao_social: string } | null;
  products: { nome: string; categoria: string | null } | null;
};

export default function PricesPage() {
  const { role } = useAuth();
  const canEdit = role === 'master' || role === 'comprador';
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; razao_social: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierPrice | null>(null);
  const [form, setForm] = useState({ supplier_id: "", product_id: "", preco_unitario: "", unidade_medida: "", quantidade_minima: "", prazo_entrega: "", observacoes: "" });
  const [loading, setLoading] = useState(false);
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});
  const [csvOpen, setCsvOpen] = useState(false);

  const fetchAll = async () => {
    const [{ data: pricesData }, { data: suppData }, { data: prodData }] = await Promise.all([
      supabase.from('supplier_prices').select('*, suppliers(razao_social), products(nome, categoria)').order('updated_at', { ascending: false }),
      supabase.from('suppliers').select('id, razao_social').eq('status', 'ativo').order('razao_social'),
      supabase.from('products').select('id, nome').eq('status', 'ativo').order('nome'),
    ]);
    const ps = (pricesData || []) as unknown as SupplierPrice[];
    setPrices(ps);
    setSuppliers(suppData || []);
    setProducts(prodData || []);

    // Calculate min price per product
    const mins: Record<string, number> = {};
    ps.forEach(p => {
      if (!mins[p.product_id] || p.preco_unitario < mins[p.product_id]) {
        mins[p.product_id] = p.preco_unitario;
      }
    });
    setMinPrices(mins);
  };

  useEffect(() => { fetchAll(); }, []);

  const pricesImportConfig = useMemo(() => {
    const productsMap = new Map(products.map(p => [p.nome.toLowerCase(), p.id]));
    const suppliersMap = new Map(suppliers.map(s => [s.razao_social.toLowerCase(), s.id]));
    return createPricesImportConfig(productsMap, suppliersMap);
  }, [products, suppliers]);

  const filtered = prices.filter(p => {
    const matchSearch = (p.suppliers?.razao_social || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.products?.nome || '').toLowerCase().includes(search.toLowerCase());
    const matchSupplier = supplierFilter === 'todos' || p.supplier_id === supplierFilter;
    return matchSearch && matchSupplier;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ supplier_id: "", product_id: "", preco_unitario: "", unidade_medida: "", quantidade_minima: "", prazo_entrega: "", observacoes: "" });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      supplier_id: form.supplier_id,
      product_id: form.product_id,
      preco_unitario: parseFloat(form.preco_unitario),
      unidade_medida: form.unidade_medida || null,
      quantidade_minima: form.quantidade_minima ? parseFloat(form.quantidade_minima) : null,
      prazo_entrega: form.prazo_entrega || null,
      observacoes: form.observacoes || null,
    };
    if (editing) {
      const { error } = await supabase.from('supplier_prices').update(payload).eq('id', editing.id);
      if (error) toast.error(error.message); else toast.success("Preço atualizado!");
    } else {
      const { error } = await supabase.from('supplier_prices').insert(payload);
      if (error) toast.error(error.message); else toast.success("Preço cadastrado!");
    }
    setLoading(false); setDialogOpen(false); fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este preço?")) return;
    const { error } = await supabase.from('supplier_prices').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success("Preço excluído!"); fetchAll(); }
  };

  // Inline edit price
  const [inlineEdit, setInlineEdit] = useState<{ id: string; value: string } | null>(null);
  const saveInline = async (id: string) => {
    if (!inlineEdit) return;
    const { error } = await supabase.from('supplier_prices').update({ preco_unitario: parseFloat(inlineEdit.value) }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success("Preço atualizado!"); setInlineEdit(null); fetchAll(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Preços por Fornecedor</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os preços de cada fornecedor</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar CSV</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Preço</Button>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por fornecedor ou produto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fornecedor</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Preço Unitário</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Prazo Entrega</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Atualizado em</th>
                  {canEdit && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum preço cadastrado.</td></tr>
                ) : filtered.map(p => {
                  const isMin = minPrices[p.product_id] === p.preco_unitario;
                  return (
                    <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/50 ${isMin ? 'bg-success/5' : ''}`}>
                      <td className="py-3 px-4 font-medium">{p.products?.nome}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.suppliers?.razao_social}</td>
                      <td className="py-3 px-4 text-right">
                        {canEdit && inlineEdit?.id === p.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input className="w-28 text-right" value={inlineEdit.value}
                              onChange={e => setInlineEdit({ id: p.id, value: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && saveInline(p.id)}
                              onBlur={() => saveInline(p.id)} autoFocus />
                          </div>
                        ) : (
                          <span className={`currency font-medium cursor-pointer ${isMin ? 'text-success' : ''}`}
                            onClick={() => canEdit && setInlineEdit({ id: p.id, value: p.preco_unitario.toString() })}>
                            {isMin && <TrendingDown className="h-3 w-3 inline mr-1" />}
                            {formatCurrency(p.preco_unitario)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{p.prazo_entrega || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{formatDate(p.updated_at)}</td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Preço" : "Novo Preço"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select value={form.product_id} onValueChange={v => setForm({...form, product_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço Unitário (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_unitario} onChange={e => setForm({...form, preco_unitario: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Quantidade Mínima</Label>
                <Input type="number" step="0.01" value={form.quantidade_minima} onChange={e => setForm({...form, quantidade_minima: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Prazo de Entrega</Label>
                <Input value={form.prazo_entrega} onChange={e => setForm({...form, prazo_entrega: e.target.value})} />
              </div>
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

      <CsvImportModal config={pricesImportConfig} open={csvOpen} onOpenChange={setCsvOpen} onComplete={fetchAll} />
    </div>
  );
}
