import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Search } from "lucide-react";
import { toast } from "sonner";
import { TITULOS_SOLICITACAO } from "@/lib/constants";

type ImportedItem = { product_id: string; nome: string; unidade_medida: string; saldo: string; observacoes: string };

export default function InventoryImportDialog({
  open, onOpenChange, hasItems, onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasItems: boolean;
  onImport: (items: ImportedItem[], mode: 'replace' | 'append') => void;
}) {
  const [tituloFilter, setTituloFilter] = useState<string>("__todos");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("__todas");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ['inventories-for-import'],
    queryFn: async () => {
      const { data: invs } = await (supabase as any).from('inventories')
        .select('id, titulo, categoria, unidade, setor, created_at')
        .order('created_at', { ascending: false });
      return (invs || []) as Array<{ id: string; titulo: string; categoria: string | null; unidade: string | null; setor: string | null; created_at: string }>;
    },
    enabled: open,
  });

  const inventories = data || [];
  const categories = useMemo(() => Array.from(new Set(inventories.map(i => i.categoria).filter(Boolean))).sort() as string[], [inventories]);

  const filtered = inventories.filter(i =>
    (tituloFilter === '__todos' || i.titulo === tituloFilter) &&
    (categoriaFilter === '__todas' || i.categoria === categoriaFilter) &&
    (!search || i.titulo.toLowerCase().includes(search.toLowerCase()))
  );

  const doImport = async (invId: string) => {
    const { data: items } = await (supabase as any).from('inventory_items')
      .select('product_id, saldo, observacoes, products(nome, unidade_medida)')
      .eq('inventory_id', invId);
    if (!items || items.length === 0) { toast.error("Inventário sem itens."); return; }
    const mapped: ImportedItem[] = items.map((it: any) => ({
      product_id: it.product_id,
      nome: it.products?.nome || '—',
      unidade_medida: it.products?.unidade_medida || '',
      saldo: String(it.saldo || 0),
      observacoes: it.observacoes || '',
    }));

    let mode: 'replace' | 'append' = 'append';
    if (hasItems) {
      const replace = window.confirm("Já existem itens na solicitação. Clique OK para SUBSTITUIR todos os itens, ou Cancelar para ADICIONAR aos existentes.");
      mode = replace ? 'replace' : 'append';
    }
    onImport(mapped, mode);
    toast.success(`${mapped.length} itens importados`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" />Importar do Inventário</DialogTitle>
          <DialogDescription>Selecione um inventário para importar seus produtos e saldos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Filtrar por título</Label>
            <Select value={tituloFilter} onValueChange={setTituloFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos os títulos</SelectItem>
                {TITULOS_SOLICITACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filtrar por categoria</Label>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas">Todas as categorias</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar inventário..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="border rounded-md max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Nenhum inventário encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 text-xs">Título</th>
                <th className="text-left py-2 px-3 text-xs hidden sm:table-cell">Categoria</th>
                <th className="text-left py-2 px-3 text-xs hidden sm:table-cell">Unidade</th>
                <th className="w-24"></th>
              </tr></thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{inv.titulo}</td>
                    <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{inv.categoria || '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{inv.unidade || '—'}</td>
                    <td className="py-2 px-3 text-right"><Button size="sm" onClick={() => doImport(inv.id)}>Importar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
