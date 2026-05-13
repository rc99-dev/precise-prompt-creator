import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: string[];
};

export default function ProductsExportDialog({ open, onOpenChange, categories }: Props) {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("__all__");
  const [includeSuppliers, setIncludeSuppliers] = useState(false);
  const [abc, setAbc] = useState(false);
  const [supplierRanking, setSupplierRanking] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch products
      let q = supabase.from('products').select('*').order('nome');
      if (categoria !== "__all__") q = q.eq('categoria', categoria);
      const { data: prods, error } = await q;
      if (error) throw error;
      let products = (prods || []) as any[];
      if (search.trim()) {
        const s = search.toLowerCase();
        products = products.filter(p => p.nome.toLowerCase().includes(s));
      }
      const productIds = products.map(p => p.id);

      // Fetch supplier prices when needed
      let prices: any[] = [];
      let suppliersMap = new Map<string, any>();
      if ((includeSuppliers || supplierRanking) && productIds.length) {
        const { data: pr } = await supabase
          .from('supplier_prices')
          .select('*')
          .in('product_id', productIds);
        prices = pr || [];
        const supIds = Array.from(new Set(prices.map(p => p.supplier_id)));
        if (supIds.length) {
          const { data: sups } = await supabase
            .from('suppliers')
            .select('id, razao_social, nome_fantasia')
            .in('id', supIds);
          (sups || []).forEach(s => suppliersMap.set(s.id, s));
        }
      }

      // ABC ranking
      let abcMap = new Map<string, { total: number; classe: string }>();
      if (abc && productIds.length) {
        const validStatuses = ['aprovado', 'emitido', 'recebido', 'recebido_com_ocorrencia'];
        const { data: validOrders } = await supabase
          .from('purchase_orders')
          .select('id')
          .in('status', validStatuses);
        const validOrderIds = new Set((validOrders || []).map((o: any) => o.id));
        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('product_id, subtotal, order_id')
          .in('product_id', productIds);
        const totals = new Map<string, number>();
        (items || []).forEach((it: any) => {
          if (!validOrderIds.has(it.order_id)) return;
          totals.set(it.product_id, (totals.get(it.product_id) || 0) + Number(it.subtotal || 0));
        });
        const sorted = productIds
          .map(id => ({ id, total: totals.get(id) || 0 }))
          .sort((a, b) => b.total - a.total);
        const n = sorted.length;
        sorted.forEach((row, i) => {
          const pct = (i + 1) / n;
          const classe = pct <= 0.2 ? 'A' : pct <= 0.5 ? 'B' : 'C';
          abcMap.set(row.id, { total: row.total, classe });
        });
      }

      // Build main rows
      type Row = Record<string, any>;
      const baseRow = (p: any): Row => ({
        Nome: p.nome,
        Código: p.codigo_interno || '',
        Categoria: p.categoria || '',
        Unidade: p.unidade_medida,
        Marca: p.marca || '',
        Descrição: p.descricao || '',
        Status: p.status,
      });

      let rows: Row[] = [];
      if (includeSuppliers) {
        products.forEach(p => {
          const productPrices = prices.filter(pr => pr.product_id === p.id);
          if (productPrices.length === 0) {
            const r = baseRow(p);
            r['Fornecedor'] = '';
            r['Preço Unitário'] = '';
            if (abc) {
              const a = abcMap.get(p.id);
              r['Total Comprado'] = a?.total ?? 0;
              r['Classe ABC'] = a?.classe ?? 'C';
            }
            rows.push(r);
          } else {
            productPrices.forEach(pr => {
              const sup = suppliersMap.get(pr.supplier_id);
              const r = baseRow(p);
              r['Fornecedor'] = sup ? (sup.nome_fantasia || sup.razao_social) : '';
              r['Preço Unitário'] = Number(pr.preco_unitario || 0);
              if (abc) {
                const a = abcMap.get(p.id);
                r['Total Comprado'] = a?.total ?? 0;
                r['Classe ABC'] = a?.classe ?? 'C';
              }
              rows.push(r);
            });
          }
        });
      } else {
        rows = products.map(p => {
          const r = baseRow(p);
          if (abc) {
            const a = abcMap.get(p.id);
            r['Total Comprado'] = a?.total ?? 0;
            r['Classe ABC'] = a?.classe ?? 'C';
          }
          return r;
        });
      }

      // Sort by ABC if applicable
      if (abc) {
        rows.sort((a, b) => (b['Total Comprado'] || 0) - (a['Total Comprado'] || 0));
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Produtos");

      // Supplier ranking sheet
      if (supplierRanking) {
        const allSupplierNames = Array.from(new Set(
          prices.map(pr => {
            const s = suppliersMap.get(pr.supplier_id);
            return s ? (s.nome_fantasia || s.razao_social) : null;
          }).filter(Boolean)
        )) as string[];

        const compareRows = products.map(p => {
          const r: Row = { Produto: p.nome, Categoria: p.categoria || '', Unidade: p.unidade_medida };
          allSupplierNames.forEach(name => { r[name] = ''; });
          const productPrices = prices.filter(pr => pr.product_id === p.id);
          productPrices.forEach(pr => {
            const sup = suppliersMap.get(pr.supplier_id);
            const name = sup ? (sup.nome_fantasia || sup.razao_social) : null;
            if (name) r[name] = Number(pr.preco_unitario || 0);
          });
          // Best price
          const numericPrices = productPrices.map(pr => Number(pr.preco_unitario || 0)).filter(n => n > 0);
          r['Menor Preço'] = numericPrices.length ? Math.min(...numericPrices) : '';
          r['Maior Preço'] = numericPrices.length ? Math.max(...numericPrices) : '';
          return r;
        });
        const ws2 = XLSX.utils.json_to_sheet(compareRows);
        XLSX.utils.book_append_sheet(wb, ws2, "Ranking Fornecedores");
      }

      const ts = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `produtos_${ts}.xlsx`);
      toast.success(`${rows.length} linhas exportadas`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Exportar Produtos</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar por nome</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar produtos..." />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Incluir fornecedores e preços</Label>
              <p className="text-xs text-muted-foreground">Adiciona colunas de fornecedor e preço</p>
            </div>
            <Switch checked={includeSuppliers} onCheckedChange={setIncludeSuppliers} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Ranking ABC</Label>
              <p className="text-xs text-muted-foreground">Classifica por valor total de compras</p>
            </div>
            <Switch checked={abc} onCheckedChange={setAbc} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Ranking preços por fornecedor</Label>
              <p className="text-xs text-muted-foreground">Aba extra com comparativo lado a lado</p>
            </div>
            <Switch checked={supplierRanking} onCheckedChange={setSupplierRanking} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Exportar XLSX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
