import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/helpers";

type ImportedItem = {
  product_id: string;
  nome: string;
  unidade_medida: string;
  saldo: string;
  observacoes: string;
};

type Inventory = {
  id: string;
  titulo: string;
  categoria: string | null;
  unidade: string | null;
  setor: string | null;
  created_at: string;
  user_id: string;
};

export default function InventoryImportDialog({
  open, onOpenChange, hasItems, onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasItems: boolean;
  onImport: (items: ImportedItem[], mode: 'replace' | 'append') => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'replace' | 'append'>('append');

  const { data, isLoading } = useQuery({
    queryKey: ['inventories-for-import-v2'],
    queryFn: async () => {
      const { data: invs } = await (supabase as any).from('inventories')
        .select('id, titulo, categoria, unidade, setor, created_at, user_id')
        .order('created_at', { ascending: false });
      const inventories = (invs || []) as Inventory[];
      const userIds = Array.from(new Set(inventories.map(i => i.user_id)));
      const { data: names } = userIds.length
        ? await supabase.rpc('get_profile_names', { _user_ids: userIds } as any)
        : { data: [] as any[] };
      const nameMap: Record<string, string> = {};
      (names || []).forEach((n: any) => { nameMap[n.user_id] = n.full_name; });
      return { inventories, nameMap };
    },
    enabled: open,
  });

  const { data: selectedItems, isLoading: loadingItems } = useQuery({
    queryKey: ['inventory-items-for-import', selectedInventoryId],
    queryFn: async () => {
      if (!selectedInventoryId) return [];
      const { data: items } = await (supabase as any).from('inventory_items')
        .select('id, product_id, saldo, observacoes, products(nome, unidade_medida)')
        .eq('inventory_id', selectedInventoryId);
      return (items || []).map((it: any) => ({
        id: it.id,
        product_id: it.product_id,
        nome: it.products?.nome || '—',
        unidade_medida: it.products?.unidade_medida || '',
        saldo: String(it.saldo || 0),
        observacoes: it.observacoes || '',
      }));
    },
    enabled: !!selectedInventoryId && open,
  });

  const inventories = data?.inventories || [];
  const nameMap = data?.nameMap || {};

  const filtered = inventories.filter(i =>
    !search || i.titulo.toLowerCase().includes(search.toLowerCase()) || (i.unidade || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!selectedItems) return;
    if (selectedItemIds.size === selectedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(selectedItems.map(i => i.id)));
    }
  };

  const handleSelectInventory = (invId: string) => {
    setSelectedInventoryId(invId);
    setSelectedItemIds(new Set());
  };

  const handleBack = () => {
    setSelectedInventoryId(null);
    setSelectedItemIds(new Set());
  };

  const handleImport = () => {
    if (!selectedItems) return;
    const toImport = selectedItems
      .filter(i => selectedItemIds.has(i.id))
      .map(i => ({
        product_id: i.product_id,
        nome: i.nome,
        unidade_medida: i.unidade_medida,
        saldo: i.saldo,
        observacoes: i.observacoes,
      }));
    if (toImport.length === 0) {
      toast.error("Selecione pelo menos um item para importar.");
      return;
    }
    if (hasItems && mode === 'replace') {
      onImport(toImport, 'replace');
    } else {
      onImport(toImport, 'append');
    }
    toast.success(`${toImport.length} item(ns) importado(s)`);
    // Reset
    setSelectedInventoryId(null);
    setSelectedItemIds(new Set());
    setSearch("");
    onOpenChange(false);
  };

  const selectedInventory = inventories.find(i => i.id === selectedInventoryId);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setSelectedInventoryId(null);
        setSelectedItemIds(new Set());
        setSearch("");
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Importar do Inventário
          </DialogTitle>
          <DialogDescription>
            {selectedInventoryId
              ? `Selecione os itens de ${selectedInventory?.titulo || 'Inventário'} que deseja importar.`
              : "Escolha um inventário para ver seus itens."}
          </DialogDescription>
        </DialogHeader>

        {!selectedInventoryId ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar inventário por título ou unidade..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Nenhum inventário encontrado</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3 text-xs">Título</th>
                      <th className="text-left py-2 px-3 text-xs hidden sm:table-cell">Unidade</th>
                      <th className="text-left py-2 px-3 text-xs hidden md:table-cell">Criado por</th>
                      <th className="text-left py-2 px-3 text-xs hidden sm:table-cell">Data</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(inv => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{inv.titulo}</td>
                        <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{inv.unidade || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">{nameMap[inv.user_id] || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{formatDate(inv.created_at)}</td>
                        <td className="py-2 px-3 text-right">
                          <Button size="sm" onClick={() => handleSelectInventory(inv.id)}>Ver itens</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button type="button" variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar
              </Button>
              {hasItems && (
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs">Modo:</Label>
                  <select
                    className="text-xs border rounded px-2 py-1 bg-background"
                    value={mode}
                    onChange={e => setMode(e.target.value as 'replace' | 'append')}
                  >
                    <option value="append">Adicionar aos existentes</option>
                    <option value="replace">Substituir existentes</option>
                  </select>
                </div>
              )}
            </div>
            {loadingItems ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Carregando itens...</div>
            ) : !selectedItems || selectedItems.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Este inventário não possui itens.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 py-2 border-b bg-muted/30 px-3">
                  <Checkbox
                    checked={selectedItemIds.size === selectedItems.length && selectedItems.length > 0}
                    indeterminate={selectedItemIds.size > 0 && selectedItemIds.size < selectedItems.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-xs font-medium">
                    {selectedItemIds.size} de {selectedItems.length} selecionado(s)
                  </span>
                </div>
                <div className="border rounded-md max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {selectedItems.map(item => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3 w-10">
                            <Checkbox
                              checked={selectedItemIds.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.nome}</div>
                            <div className="text-xs text-muted-foreground">{item.unidade_medida}</div>
                          </td>
                          <td className="py-2 px-3 text-right w-24">
                            <span className="text-sm font-semibold">{item.saldo}</span>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-xs w-32 hidden sm:table-cell">
                            {item.observacoes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={handleBack}>Voltar</Button>
                  <Button onClick={handleImport} disabled={selectedItemIds.size === 0}>
                    Importar {selectedItemIds.size > 0 ? `${selectedItemIds.size} item(s)` : ''}
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
