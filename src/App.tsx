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
import ProductPurchaseHistoryPage from "@/pages/ProductPurchaseHistoryPage";
import ConsumptionAnalysisPage from "@/pages/ConsumptionAnalysisPage";
import FinancialComparisonPage from "@/pages/FinancialComparisonPage";
import ComparativePage from "@/pages/ComparativePage";
import MyRequisitionsPage from "@/pages/MyRequisitionsPage";
import RequisitionsPage from "@/pages/RequisitionsPage";
import TriagemPage from "@/pages/TriagemPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import ReceiptsPage from "@/pages/ReceiptsPage";
import UsersPage from "@/pages/UsersPage";
import ReportsPage from "@/pages/ReportsPage";
import NotFound from "@/pages/NotFound";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import InventoriesPage from "@/pages/InventoriesPage";
import InventoryHistoryPage from "@/pages/InventoryHistoryPage";
import PcpPage from "@/pages/PcpPage";
import PcpLayout from "@/pages/admin/suprimentos/PcpLayout";
import PcpDashboardPage from "@/pages/admin/suprimentos/PcpDashboardPage";
import PcpComprasPage from "@/pages/admin/suprimentos/PcpComprasPage";
import PcpRendimentoPage from "@/pages/admin/suprimentos/PcpRendimentoPage";
import PcpEstoquePage from "@/pages/admin/suprimentos/PcpEstoquePage";
import PcpDistribuicaoPage from "@/pages/admin/suprimentos/PcpDistribuicaoPage";
import PcpRateioPage from "@/pages/admin/suprimentos/PcpRateioPage";
import PcpReembolsosPage from "@/pages/admin/suprimentos/PcpReembolsosPage";
import PcpValidadesPage from "@/pages/admin/suprimentos/PcpValidadesPage";
import PcpProducaoPage from "@/pages/admin/suprimentos/PcpProducaoPage";
import PcpRelatoriosPage from "@/pages/admin/suprimentos/PcpRelatoriosPage";
import PcpTriagemPage from "@/pages/admin/suprimentos/PcpTriagemPage";
import PcpCdpPage from "@/pages/admin/suprimentos/PcpCdpPage";
import { canAccess } from "@/lib/helpers";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading, role, profileStatus, customPermissions } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Pending approval screen
  if (profileStatus === 'pendente') {
    return <PendingApprovalPage />;
  }

  // Solicitante only sees their page
  if (role === 'solicitante') {
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/minhas-solicitacoes" replace />} />
          <Route path="/minhas-solicitacoes" element={<MyRequisitionsPage />} />
          <Route path="/inventarios" element={<InventoriesPage />} />
          <Route path="/historico-inventarios" element={<InventoryHistoryPage />} />
          <Route path="*" element={<Navigate to="/minhas-solicitacoes" replace />} />
        </Routes>
      </AppLayout>
    );
  }

  const canOrLoading = (page: string) => loading || canAccess(role, page, customPermissions);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/minhas-solicitacoes" element={<MyRequisitionsPage />} />
        {canOrLoading('solicitacoes') && <Route path="/solicitacoes" element={<RequisitionsPage />} />}
        {canOrLoading('triagem') && <Route path="/triagem" element={<TriagemPage />} />}
        {canOrLoading('fornecedores') && <Route path="/fornecedores" element={<SuppliersPage />} />}
        {canOrLoading('produtos') && <Route path="/produtos" element={<ProductsPage />} />}
        {canOrLoading('precos') && <Route path="/precos" element={<PricesPage />} />}
        {canOrLoading('nova-ordem') && <Route path="/nova-ordem" element={<NewOrderPage />} />}
        {canOrLoading('historico') && <Route path="/historico" element={<OrderHistoryPage />} />}
        {canOrLoading('historico-produto') && <Route path="/historico-produto" element={<ProductPurchaseHistoryPage />} />}
        {canOrLoading('analise-consumo') && <Route path="/analise-consumo" element={<ConsumptionAnalysisPage />} />}
        {canOrLoading('comparativo-financeiro') && <Route path="/comparativo-financeiro" element={<FinancialComparisonPage />} />}
        {canOrLoading('comparativo') && <Route path="/comparativo" element={<ComparativePage />} />}
        {canOrLoading('aprovacoes') && <Route path="/aprovacoes" element={<ApprovalsPage />} />}
        {canOrLoading('recebimentos') && <Route path="/recebimentos" element={<ReceiptsPage />} />}
        {canOrLoading('usuarios') && <Route path="/usuarios" element={<UsersPage />} />}
        {canOrLoading('relatorios') && <Route path="/relatorios" element={<ReportsPage />} />}
        {canOrLoading('inventarios') && <Route path="/inventarios" element={<InventoriesPage />} />}
        {canOrLoading('historico-inventarios') && <Route path="/historico-inventarios" element={<InventoryHistoryPage />} />}
        {canOrLoading('pcp') && <Route path="/pcp" element={<PcpPage />} />}
        {canOrLoading('pcp') && (
          <Route path="/admin/suprimentos/pcp" element={<PcpLayout />}>
            <Route index element={<PcpDashboardPage />} />
            <Route path="compras" element={<PcpComprasPage />} />
            <Route path="rendimento" element={<PcpRendimentoPage />} />
            <Route path="estoque" element={<PcpEstoquePage />} />
            <Route path="cdp" element={<PcpCdpPage />} />
            <Route path="triagem" element={<PcpTriagemPage />} />
            <Route path="distribuicao" element={<PcpDistribuicaoPage />} />
            <Route path="rateio" element={<PcpRateioPage />} />
            <Route path="reembolsos" element={<PcpReembolsosPage />} />
            <Route path="validades" element={<PcpValidadesPage />} />
            <Route path="producao" element={<PcpProducaoPage />} />
            <Route path="relatorios" element={<PcpRelatoriosPage />} />
          </Route>
        )}
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
