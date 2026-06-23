import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Factory, LayoutDashboard, ShoppingCart, Scale, Boxes, Truck, Calculator, RefreshCcw, Clock, ChefHat, FileBarChart, Split, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const SUB_NAV = [
  { to: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "compras", label: "Compras", icon: ShoppingCart },
  { to: "rendimento", label: "Rendimento", icon: Scale },
  { to: "cdp", label: "CDP", icon: Warehouse },
  { to: "triagem", label: "Triagem", icon: Split },
  { to: "estoque", label: "Estoque CDP", icon: Boxes },
  { to: "distribuicao", label: "Distribuição", icon: Truck },
  { to: "rateio", label: "Rateio", icon: Calculator },
  { to: "reembolsos", label: "Reembolsos", icon: RefreshCcw },
  { to: "validades", label: "Validades", icon: Clock },
  { to: "producao", label: "Produção", icon: ChefHat },
  { to: "relatorios", label: "Relatórios", icon: FileBarChart },
];

export default function PcpLayout() {
  const { pathname } = useLocation();
  const base = "/admin/suprimentos/pcp";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Factory className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">PCP — Planejamento e Controle de Produção</h1>
          <p className="text-sm text-muted-foreground">
            Central de Distribuição de Proteínas · Compras, rendimento, validades e CMV
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        {SUB_NAV.map((item) => {
          const to = item.to ? `${base}/${item.to}` : base;
          const isActive = item.end ? pathname === to || pathname === base : pathname.startsWith(to);
          return (
            <NavLink
              key={item.to}
              to={to}
              end={item.end}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
