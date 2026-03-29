import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Package, ShoppingCart, Plus, TrendingDown, Clock, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate, statusLabels, statusColors } from "@/lib/helpers";
import { useQuery } from "@tanstack/react-query";
import QueryError from "@/components/QueryError";

export default function DashboardPage() {
  const { role } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const [{ count: sc }, { count: pc }, { count: pendReqs }, { count: pendApprovals }, { data: orders }] = await Promise.all([
        supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('requisitions').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'aguardando_aprovacao'),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      const monthOrders = (orders || []).filter(o => new Date(o.created_at) >= startOfMonth);
      const monthTotal = monthOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      return {
        stats: { suppliers: sc || 0, products: pc || 0, pendingReqs: pendReqs || 0, pendingApprovals: pendApprovals || 0, monthOrders: monthOrders.length, monthTotal },
        recentOrders: orders || [],
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const stats = data?.stats || { suppliers: 0, products: 0, pendingReqs: 0, pendingApprovals: 0, monthOrders: 0, monthTotal: 0 };
  const recentOrders = data?.recentOrders || [];

  const statusBadge = (status: string) => (
    <Badge className={statusColors[status] || 'bg-muted text-muted-foreground'}>{statusLabels[status] || status}</Badge>
  );

  const StatCard = ({ title, icon: Icon, value, className }: { title: string; icon: any; value: React.ReactNode; className?: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-9 w-24" /> : <div className={`text-3xl font-bold ${className || ''}`}>{value}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role === 'aprovador' ? 'Fila de aprovações' : role === 'estoquista' ? 'Entregas e recebimentos' : 'Visão geral do sistema'}
          </p>
        </div>
        {(role === 'comprador' || role === 'master') && (
          <Link to="/nova-ordem"><Button><Plus className="h-4 w-4 mr-2" />Nova Ordem</Button></Link>
        )}
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {!isLoading && (role === 'comprador' || role === 'master') && stats.pendingReqs > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <ClipboardList className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium">{stats.pendingReqs} solicitação(ões) pendente(s)</p>
              <p className="text-xs text-muted-foreground">Solicitantes aguardam inclusão em pedido</p>
            </div>
            <Link to="/solicitacoes"><Button size="sm" variant="outline">Ver</Button></Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && (role === 'aprovador' || role === 'master') && stats.pendingApprovals > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Clock className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{stats.pendingApprovals} pedido(s) aguardando aprovação</p>
            </div>
            <Link to="/aprovacoes"><Button size="sm">Aprovar</Button></Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(role === 'comprador' || role === 'master') && (
          <>
            <StatCard title="Pedidos do Mês" icon={ShoppingCart} value={stats.monthOrders} />
            <StatCard title="Total do Mês" icon={TrendingDown} value={formatCurrency(stats.monthTotal)} className="currency" />
          </>
        )}
        {role === 'master' && (
          <>
            <StatCard title="Fornecedores" icon={Building2} value={stats.suppliers} />
            <StatCard title="Produtos" icon={Package} value={stats.products} />
          </>
        )}
        {role === 'aprovador' && (
          <StatCard title="Aguardando Aprovação" icon={Clock} value={stats.pendingApprovals} className="text-warning" />
        )}
      </div>

      {role !== 'solicitante' && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Últimos Pedidos</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4"><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" /></div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma ordem de compra ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Número</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.slice(0, 8).map((order: any) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{order.numero}</td>
                        <td className="py-3 px-2 text-muted-foreground">{formatDate(order.created_at)}</td>
                        <td className="py-3 px-2 text-right currency font-medium">{formatCurrency(order.total)}</td>
                        <td className="py-3 px-2 text-center">{statusBadge(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
