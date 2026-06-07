import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, X } from "lucide-react";

type Supplier = { id: string; razao_social: string };

interface Props {
  suppliers: Supplier[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
  helperText?: string;
  showBadges?: boolean;
  align?: "start" | "center" | "end";
}

export default function SupplierFilterPopover({
  suppliers,
  selected,
  onChange,
  label = "Filtrar fornecedores",
  helperText = "Vazio = todos os fornecedores.",
  showBadges = true,
  align = "end",
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return suppliers;
    return suppliers.filter(s => s.razao_social.toLowerCase().includes(t));
  }, [suppliers, search]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showBadges && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(id => {
            const s = suppliers.find(x => x.id === id);
            if (!s) return null;
            return (
              <Badge key={id} variant="secondary" className="text-[10px] gap-1 pr-1">
                {s.razao_social}
                <button onClick={() => toggle(id)} className="hover:text-destructive ml-0.5" aria-label={`Remover ${s.razao_social}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            {label}
            {selected.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({selected.length})</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align={align}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Pesquisar fornecedor..."
                className="pl-7 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{filtered.length} fornecedor(es)</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground">
                  Limpar seleção
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">Nenhum fornecedor encontrado.</div>
            )}
            {filtered.map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm">
                <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="flex-1">{s.razao_social}</span>
              </label>
            ))}
          </div>
          <div className="p-2 border-t text-[11px] text-muted-foreground">{helperText}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
