import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SuppliersPage from "@/pages/SuppliersPage";
import ProductsPage from "@/pages/ProductsPage";
import PricesPage from "@/pages/PricesPage";
import NewOrderPage from "@/pages/NewOrderPage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import ComparativePage from "@/pages/ComparativePage";
import MyRequisitionsPage from "@/pages/MyRequisitionsPage";
import RequisitionsPage from "@/pages/RequisitionsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import ReceiptsPage from "@/pages/ReceiptsPage";
import UsersPage from "@/pages/UsersPage";
import ReportsPage from "@/pages/ReportsPage";
import NotFound from "@/pages/NotFound";
import { canAccess } from "@/lib/helpers";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Solicitante only sees their page
  if (role === 'solicitante') {
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/minhas-solicitacoes" replace />} />
          <Route path="/minhas-solicitacoes" element={<MyRequisitionsPage />} />
          <Route path="*" element={<Navigate to="/minhas-solicitacoes" replace />} />
        </Routes>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/minhas-solicitacoes" element={<MyRequisitionsPage />} />
        {canAccess(role, 'solicitacoes') && <Route path="/solicitacoes" element={<RequisitionsPage />} />}
        {canAccess(role, 'fornecedores') && <Route path="/fornecedores" element={<SuppliersPage />} />}
        {canAccess(role, 'produtos') && <Route path="/produtos" element={<ProductsPage />} />}
        {canAccess(role, 'precos') && <Route path="/precos" element={<PricesPage />} />}
        {canAccess(role, 'nova-ordem') && <Route path="/nova-ordem" element={<NewOrderPage />} />}
        {canAccess(role, 'historico') && <Route path="/historico" element={<OrderHistoryPage />} />}
        {canAccess(role, 'comparativo') && <Route path="/comparativo" element={<ComparativePage />} />}
        {canAccess(role, 'aprovacoes') && <Route path="/aprovacoes" element={<ApprovalsPage />} />}
        {canAccess(role, 'recebimentos') && <Route path="/recebimentos" element={<ReceiptsPage />} />}
        {canAccess(role, 'usuarios') && <Route path="/usuarios" element={<UsersPage />} />}
        {canAccess(role, 'relatorios') && <Route path="/relatorios" element={<ReportsPage />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoutes() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <LoginPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthRoutes />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
