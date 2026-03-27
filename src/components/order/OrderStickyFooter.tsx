import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, ShoppingCart, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

interface Props {
  total: number;
  economy: number;
  itemCount: number;
  saving: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export default function OrderStickyFooter({ total, economy, itemCount, saving, onSaveDraft, onSubmit }: Props) {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-xl font-bold">{formatCurrency(total)}</p>
          </div>
          {economy > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Economia</p>
              <p className="text-sm font-semibold text-green-400 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />{formatCurrency(economy)}
              </p>
            </div>
          )}
          <Badge variant="outline" className="text-xs">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />Rascunho
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={saving}>
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Enviar para Aprovação
          </Button>
        </div>
      </div>
    </div>
  );
}
