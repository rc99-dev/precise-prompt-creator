import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Users, Trophy, Lightbulb, Check } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

interface StrategyItem {
  product_id: string;
  quantidade: number;
}

interface PriceEntry {
  supplier_id: string;
  product_id: string;
  preco_unitario: number;
}

interface Supplier {
  id: string;
  razao_social: string;
}

export interface StrategyAnalysis {
  bestPerItem: {
    total: number;
    supplierCount: number;
    supplierNames: string[];
  };
  bestSingle: {
    supplierId: string;
    supplierName: string;
    total: number;
    coverage: number;
    ranking: { supplierId: string; supplierName: string; total: number; coverage: number }[];
  } | null;
  difference: number;
  recommendation: string;
  recommendedStrategy: "melhor_preco" | "melhor_fornecedor";
}

export function useStrategyAnalysis(
  items: StrategyItem[],
  allPrices: PriceEntry[],
  suppliers: Supplier[]
): StrategyAnalysis | null {
  return useMemo(() => {
    if (items.length === 0) return null;

    const priceMap: Record<string, Record<string, number>> = {};
    allPrices.forEach(p => {
      if (!priceMap[p.product_id]) priceMap[p.product_id] = {};
      priceMap[p.product_id][p.supplier_id] = p.preco_unitario;
    });

    // Strategy 1: Best price per item
    let bestPerItemTotal = 0;
    const usedSuppliers = new Set<string>();
    items.forEach(item => {
      const productPrices = priceMap[item.product_id] || {};
      const entries = Object.entries(productPrices);
      if (entries.length > 0) {
        const [bestSid, bestPrice] = entries.reduce((min, curr) => curr[1] < min[1] ? curr : min);
        bestPerItemTotal += bestPrice * item.quantidade;
        usedSuppliers.add(bestSid);
      }
    });

    // Strategy 2: Best single supplier – ranking
    const ranking: { supplierId: string; supplierName: string; total: number; coverage: number }[] = [];
    suppliers.forEach(s => {
      let total = 0;
      let coverage = 0;
      items.forEach(item => {
        const price = priceMap[item.product_id]?.[s.id];
        if (price && price > 0) {
          total += price * item.quantidade;
          coverage++;
        }
      });
      if (coverage > 0) {
        ranking.push({ supplierId: s.id, supplierName: s.razao_social, total, coverage });
      }
    });
    ranking.sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return a.total - b.total;
    });

    const bestSingle = ranking.length > 0
      ? { supplierId: ranking[0].supplierId, supplierName: ranking[0].supplierName, total: ranking[0].total, coverage: ranking[0].coverage, ranking }
      : null;

    const difference = bestSingle ? bestSingle.total - bestPerItemTotal : 0;

    // Recommendation
    let recommendation = "";
    let recommendedStrategy: "melhor_preco" | "melhor_fornecedor" = "melhor_preco";

    if (!bestSingle) {
      recommendation = "Sem fornecedores com preços cadastrados para comparação.";
    } else if (bestSingle.coverage < items.length) {
      recommendation = `Dividir entre ${usedSuppliers.size} fornecedor(es) é a única opção — nenhum fornecedor cobre todos os ${items.length} itens. O melhor (${bestSingle.supplierName}) cobre ${bestSingle.coverage}/${items.length}.`;
      recommendedStrategy = "melhor_preco";
    } else if (difference === 0) {
      recommendation = `O Fornecedor ${bestSingle.supplierName} cobre todos os itens com o menor total global — recomendado.`;
      recommendedStrategy = "melhor_fornecedor";
    } else if (difference <= bestPerItemTotal * 0.05) {
      recommendation = `Comprar tudo do Fornecedor ${bestSingle.supplierName} custa ${formatCurrency(difference)} a mais, mas concentra o pedido em um único fornecedor — recomendado pela praticidade.`;
      recommendedStrategy = "melhor_fornecedor";
    } else {
      recommendation = `Dividir entre ${usedSuppliers.size} fornecedores economiza ${formatCurrency(difference)} — recomendado.`;
      recommendedStrategy = "melhor_preco";
    }

    return {
      bestPerItem: {
        total: bestPerItemTotal,
        supplierCount: usedSuppliers.size,
        supplierNames: [...usedSuppliers].map(id => suppliers.find(s => s.id === id)?.razao_social || id),
      },
      bestSingle,
      difference,
      recommendation,
      recommendedStrategy,
    };
  }, [items, allPrices, suppliers]);
}

interface StrategyCardsProps {
  analysis: StrategyAnalysis;
  selectedStrategy?: string | null;
  onSelect?: (strategy: "melhor_preco" | "melhor_fornecedor") => void;
  showSelectButton?: boolean;
}

export default function StrategyCards({ analysis, selectedStrategy, onSelect, showSelectButton = false }: StrategyCardsProps) {
  const isSelected = (s: string) => selectedStrategy === s;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Strategy 1 */}
        <Card
          className={`cursor-pointer transition-all border-2 ${isSelected("melhor_preco") ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-primary/30"}`}
          onClick={() => onSelect?.("melhor_preco")}
        >
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estratégia 1</p>
                  <p className="text-sm font-bold">Melhor Preço por Item</p>
                </div>
              </div>
              {isSelected("melhor_preco") && <Check className="h-5 w-5 text-primary" />}
              {analysis.recommendedStrategy === "melhor_preco" && !selectedStrategy && (
                <Badge variant="default" className="text-[10px] bg-success/20 text-success border-success/30">Recomendado</Badge>
              )}
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(analysis.bestPerItem.total)}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {analysis.bestPerItem.supplierCount} fornecedor(es)
              </p>
            </div>
            {showSelectButton && onSelect && (
              <button
                className="mt-2 w-full text-xs font-medium py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSelect("melhor_preco"); }}
              >
                Aplicar estratégia
              </button>
            )}
          </CardContent>
        </Card>

        {/* Strategy 2 */}
        {analysis.bestSingle && (
          <Card
            className={`cursor-pointer transition-all border-2 ${isSelected("melhor_fornecedor") ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-primary/30"}`}
            onClick={() => onSelect?.("melhor_fornecedor")}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estratégia 2</p>
                    <p className="text-sm font-bold">Melhor Fornecedor Único</p>
                  </div>
                </div>
                {isSelected("melhor_fornecedor") && <Check className="h-5 w-5 text-primary" />}
                {analysis.recommendedStrategy === "melhor_fornecedor" && !selectedStrategy && (
                  <Badge variant="default" className="text-[10px] bg-success/20 text-success border-success/30">Recomendado</Badge>
                )}
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(analysis.bestSingle.total)}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Trophy className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {analysis.bestSingle.supplierName} ({analysis.bestSingle.coverage}/{analysis.bestSingle.ranking.length > 0 ? analysis.bestSingle.ranking[0].coverage : 0} itens)
                </p>
              </div>
              {/* Mini ranking */}
              {analysis.bestSingle.ranking.length > 1 && (
                <div className="mt-2 space-y-0.5">
                  {analysis.bestSingle.ranking.slice(0, 3).map((r, i) => (
                    <div key={r.supplierId} className="flex items-center justify-between text-[10px]">
                      <span className={`${i === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {i + 1}º {r.supplierName}
                      </span>
                      <span className={`${i === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {formatCurrency(r.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {showSelectButton && onSelect && (
                <button
                  className="mt-2 w-full text-xs font-medium py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onSelect("melhor_fornecedor"); }}
                >
                  Aplicar estratégia
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Strategy 3: Comparison */}
        <Card className="border-2 border-transparent">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Análise</p>
                <p className="text-sm font-bold">Comparação</p>
              </div>
            </div>
            {analysis.bestSingle && (
              <div className="space-y-1.5 mt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Melhor por item:</span>
                  <span className="font-semibold">{formatCurrency(analysis.bestPerItem.total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Forn. único:</span>
                  <span className="font-semibold">{formatCurrency(analysis.bestSingle.total)}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-1.5">
                  <span className="text-muted-foreground">Diferença:</span>
                  <span className={`font-bold ${analysis.difference > 0 ? "text-warning" : "text-success"}`}>
                    {analysis.difference > 0 ? "+" : ""}{formatCurrency(analysis.difference)}
                  </span>
                </div>
              </div>
            )}
            <div className="mt-3 p-2 rounded-md bg-muted/50 border">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                💡 {analysis.recommendation}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
