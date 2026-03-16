import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Package, ShoppingCart, Plus, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ suppliers: 0, products: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: sc }, { count: pc }, { data: orders }] = await Promise.all([
        supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      setStats({ suppliers: sc || 0, products: pc || 0 });
      setRecentOrders(orders || []);
    };
    fetchStats();
  }, []);

  const statusVariant = (s: string) => {
    if (s === 'finalizado') return 'default';
    if (s === 'enviado') return 'secondary';
    return 'outline';
  };

  const statusLabel = (s: string) => {
    if (s === 'rascunho') return 'Rascunho';
    if (s === 'finalizado') return 'Finalizado';
    return 'Enviado';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema de compras</p>
        </div>
        <Link to="/nova-ordem">
          <Button><Plus className="h-4 w-4 mr-2" />Nova Ordem</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores Ativos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold currency">{stats.suppliers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtos Cadastrados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold currency">{stats.products}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ordens de Compra</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold currency">{recentOrders.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Ordens de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma ordem de compra ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Número</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor Total</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{order.numero}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDate(order.created_at)}</td>
                      <td className="py-3 px-2 text-right currency font-medium">{formatCurrency(order.total)}</td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
