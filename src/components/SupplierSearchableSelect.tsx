import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Supplier = { id: string; razao_social: string };

interface Props {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SupplierSearchableSelect({ suppliers, value, onChange, placeholder = "Selecione um fornecedor", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = suppliers.find(s => s.id === value);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return suppliers;
    return suppliers.filter(s => s.razao_social.toLowerCase().includes(t));
  }, [suppliers, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("justify-between h-8 text-sm font-normal", className)}>
          <span className="truncate">{selected?.razao_social || placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input autoFocus placeholder="Pesquisar..." className="pl-7 h-8 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">Nenhum encontrado.</div>}
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}
              className={cn("w-full text-left px-2 py-1.5 rounded-sm text-sm flex items-center gap-2 hover:bg-accent",
                value === s.id && "bg-accent/50")}
            >
              <Check className={cn("h-3.5 w-3.5", value === s.id ? "opacity-100" : "opacity-0")} />
              <span className="flex-1 truncate">{s.razao_social}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
