import { memo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

type Supplier = { id: string; razao_social: string };

interface OrderItem {
  product_id: string; product_name: string; unidade: string;
  quantidade: number; supplier_id: string; preco_unitario: number;
  subtotal: number; observacoes: string;
}

interface Props {
  item: OrderItem;
  index: number;
  isMinPrice: boolean;
  availableSuppliers: Supplier[];
  onUpdate: (index: number, updates: Partial<OrderItem>) => void;
  onRemove: (index: number) => void;
}

function OrderItemRow({ item, index, isMinPrice, availableSuppliers, onUpdate, onRemove }: Props) {
  const handleQty = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) onUpdate(index, { quantidade: val });
  }, [index, onUpdate]);

  const handleSupplier = useCallback((v: string) => {
    onUpdate(index, { supplier_id: v });
  }, [index, onUpdate]);

  return (
    <tr className={`border-b last:border-0 ${isMinPrice ? 'bg-green-500/5' : ''}`}>
      <td className="py-2.5 px-3">
        <span className="font-medium text-sm">{item.product_name}</span>
        <span className="text-muted-foreground ml-1 text-xs">({item.unidade})</span>
      </td>
      <td className="py-2.5 px-3">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          className="w-20 text-center h-8 text-sm"
          value={item.quantidade}
          onChange={handleQty}
        />
      </td>
      <td className="py-2.5 px-3">
        <Select value={item.supplier_id} onValueChange={handleSupplier}>
          <SelectTrigger className="w-[170px] h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {availableSuppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2.5 px-3 text-right text-sm font-medium whitespace-nowrap">
        {isMinPrice && <TrendingDown className="h-3 w-3 inline mr-1 text-green-400" />}
        {formatCurrency(item.preco_unitario)}
      </td>
      <td className="py-2.5 px-3 text-right text-sm font-bold whitespace-nowrap">{formatCurrency(item.subtotal)}</td>
      <td className="py-2.5 px-3 text-right">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(index)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

export default memo(OrderItemRow);
