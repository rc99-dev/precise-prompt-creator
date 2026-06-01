import { useState, useRef, useEffect, useMemo, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";

type Product = { id: string; nome: string; codigo_interno: string | null; unidade_medida: string };

interface Props {
  products: Product[];
  excludeIds: Set<string>;
  onAdd: (product: Product) => void;
  /** value for the input's data-product-search attribute, used by keyboard flow */
  searchKey?: string;
}

export default function OrderProductSearch({ products, excludeIds, onAdd, searchKey = "order" }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return [];
    const term = search.toLowerCase();
    return products
      .filter(p => !excludeIds.has(p.id) && (p.nome.toLowerCase().includes(term) || (p.codigo_interno || "").toLowerCase().includes(term)))
      .slice(0, 8);
  }, [search, products, excludeIds]);

  useEffect(() => { setHighlight(0); }, [search]);

  const handleSelect = (p: Product) => {
    onAdd(p);
    setSearch("");
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(filtered[highlight] || filtered[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar produto por nome ou código..."
        className="pl-9"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => search && setOpen(true)}
        onKeyDown={handleKeyDown}
        data-product-search={searchKey}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-popover shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm border-b last:border-0 transition-colors ${i === highlight ? 'bg-accent' : 'hover:bg-accent/50'}`}
              onClick={() => handleSelect(p)}
              onMouseEnter={() => setHighlight(i)}
            >
              <span>
                <span className="font-medium">{p.nome}</span>
                {p.codigo_interno && <span className="text-muted-foreground ml-2 text-xs">({p.codigo_interno})</span>}
                <span className="text-muted-foreground ml-2 text-xs">• {p.unidade_medida}</span>
              </span>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-popover shadow-lg p-3 text-sm text-muted-foreground text-center">
          Nenhum produto encontrado.
        </div>
      )}
    </div>
  );
}
