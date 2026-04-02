import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canAccess, roleLabels } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Package, DollarSign,
  ShoppingCart, History, BarChart3, LogOut, Menu,
  ClipboardList, CheckCircle, Truck, Users, FileText,
  Bell, ChevronLeft,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

type NavItem = { to: string; label: string; icon: any; page: string; badge?: number };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingReqs, setPendingReqs] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (role === 'comprador' || role === 'master') {
      supabase.from('requisitions').select('id', { count: 'exact', head: true })
        .eq('status', 'pendente').then(({ count }) => setPendingReqs(count || 0));
    }
    if (role === 'aprovador' || role === 'master') {
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
        .eq('status', 'aguardando_aprovacao').then(({ count }) => setPendingApprovals(count || 0));
    }
  }, [role]);

  const allNavItems: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
    { to: "/minhas-solicitacoes", label: "Minhas Solicitações", icon: ClipboardList, page: "minhas-solicitacoes" },
    { to: "/solicitacoes", label: "Solicitações", icon: ClipboardList, page: "solicitacoes", badge: pendingReqs },
    { to: "/nova-ordem", label: "Nova Ordem", icon: ShoppingCart, page: "nova-ordem" },
    { to: "/comparativo", label: "Comparativo", icon: BarChart3, page: "comparativo" },
    { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle, page: "aprovacoes", badge: pendingApprovals },
    { to: "/recebimentos", label: "Recebimentos", icon: Truck, page: "recebimentos" },
    { to: "/historico", label: "Histórico", icon: History, page: "historico" },
    { to: "/fornecedores", label: "Fornecedores", icon: Building2, page: "fornecedores" },
    { to: "/produtos", label: "Produtos", icon: Package, page: "produtos" },
    { to: "/precos", label: "Preços", icon: DollarSign, page: "precos" },
    { to: "/usuarios", label: "Usuários", icon: Users, page: "usuarios" },
    { to: "/relatorios", label: "Relatórios", icon: FileText, page: "relatorios" },
  ];

  const navItems = allNavItems.filter(item => canAccess(role, item.page));

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 
        ${collapsed ? 'w-16' : 'w-64'} 
        bg-sidebar text-sidebar-foreground
        flex flex-col transition-all duration-200 border-r border-sidebar-border
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-4 border-b border-sidebar-border`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-lg object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h1 className="text-sm font-bold tracking-tight">Point do Açaí</h1>
                <p className="text-xs text-sidebar-muted">D'Amazônia</p>
                <p className="text-[10px] text-sidebar-muted">{role ? roleLabels[role] : ''}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block text-sidebar-muted hover:text-sidebar-foreground transition-colors">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge && item.badge > 0 ? (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
          {!collapsed && <div className="px-3 py-1 text-xs text-sidebar-muted truncate">{user?.email}</div>}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground w-full transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background image overlay */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: 'url(/back.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.06,
          }}
        />
        <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm lg:hidden">Point do Açaí</span>
          </div>
          <NotificationBell />
        </header>
        <div className="relative z-10 flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}