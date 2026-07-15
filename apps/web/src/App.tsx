import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLogo } from "./components/layout/AppLogo";
import { PublicAuthLayout } from "./components/layout/PublicAuthLayout";
import { isWebAdmin, isWebStaff, isWebTeamLeader } from "./lib/staff";
import { ThemeProvider } from "./lib/theme";
import { CommissionAdminPage } from "./pages/CommissionAdminPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerVisitsPage } from "./pages/CustomerVisitsPage";
import { DashboardHome } from "./pages/DashboardHome";
import { DashboardLayout } from "./pages/DashboardLayout";
import { InsightsPage } from "./pages/InsightsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { PriceTablesPage } from "./pages/PriceTablesPage";
import { ProductCategoriesPage } from "./pages/ProductCategoriesPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReportCustomersPage } from "./pages/ReportCustomersPage";
import { ReportOrderItemsPage } from "./pages/ReportOrderItemsPage";
import { ReportOrdersPage } from "./pages/ReportOrdersPage";
import { ReportsHubPage } from "./pages/ReportsHubPage";
import { ReportStockPage } from "./pages/ReportStockPage";
import { SellerProductsPage } from "./pages/SellerProductsPage";
import { SellersPage } from "./pages/SellersPage";
import { SellerTrackingPage } from "./pages/SellerTrackingPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { StockPage } from "./pages/StockPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { TeamsPage } from "./pages/TeamsPage";

const qc = new QueryClient();

function SellerNotice() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:h-16 md:px-6">
          <AppLogo to="/login" />
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-background"
          >
            Sair
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="max-w-md text-center text-foreground">
          O painel web é para administradores, gestores e líderes de equipe.
          Vendedores devem usar o aplicativo mobile.
        </p>
      </div>
    </div>
  );
}

const MANAGER_ROUTE_PREFIXES = ["/", "/rastreio", "/visitas", "/vendas"];

const TEAM_LEADER_ROUTE_PREFIXES = [
  "/",
  "/rastreio",
  "/visitas",
  "/vendas",
  "/insights",
];

function ManagerRouteGuard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.role !== "MANAGER") return <Outlet />;
  const allowed = MANAGER_ROUTE_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
}

function TeamLeaderRouteGuard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!isWebTeamLeader(user)) return <Outlet />;
  const allowed = TEAM_LEADER_ROUTE_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
}

function AdminOnlyRoute() {
  const { user } = useAuth();
  if (!isWebAdmin(user?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function StaffGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isWebStaff(user)) {
    return <SellerNotice />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          !loading && isWebStaff(user) ? (
            <Navigate to="/" replace />
          ) : (
            <PublicAuthLayout variant="login">
              <LoginPage />
            </PublicAuthLayout>
          )
        }
      />
      <Route
        path="/cadastro"
        element={
          !loading && user?.role === "ADMIN" ? (
            <Navigate to="/" replace />
          ) : (
            <PublicAuthLayout variant="register">
              <RegisterPage />
            </PublicAuthLayout>
          )
        }
      />
      <Route
        path="/"
        element={
          <StaffGate>
            <DashboardLayout />
          </StaffGate>
        }
      >
        <Route element={<ManagerRouteGuard />}>
          <Route element={<TeamLeaderRouteGuard />}>
            <Route index element={<DashboardHome />} />
            <Route element={<AdminOnlyRoute />}>
              <Route path="tabelas-preco" element={<PriceTablesPage />} />
              <Route
                path="produtos/categorias"
                element={<ProductCategoriesPage />}
              />
              <Route path="produtos/novo" element={<ProductFormPage />} />
              <Route
                path="produtos/:productId/editar"
                element={<ProductFormPage />}
              />
              <Route path="produtos" element={<ProductsPage />} />
              <Route path="estoque" element={<StockPage />} />
              <Route
                path="estoque/movimentos"
                element={<StockMovementsPage />}
              />
              <Route path="fornecedores" element={<SuppliersPage />} />
              <Route path="comissao" element={<CommissionAdminPage />} />
              <Route path="vendedores" element={<SellersPage />} />
              <Route
                path="vendedores/:sellerId/produtos"
                element={<SellerProductsPage />}
              />
              <Route path="equipes" element={<TeamsPage />} />
              <Route path="clientes" element={<CustomersPage />} />
              <Route path="notificacoes" element={<NotificationsPage />} />
              <Route path="permissoes" element={<PermissionsPage />} />
              <Route path="relatorios" element={<ReportsHubPage />} />
              <Route
                path="relatorios/clientes"
                element={<ReportCustomersPage />}
              />
              <Route path="relatorios/pedidos" element={<ReportOrdersPage />} />
              <Route
                path="relatorios/itens"
                element={<ReportOrderItemsPage />}
              />
              <Route path="relatorios/estoque" element={<ReportStockPage />} />
            </Route>
            <Route path="visitas" element={<CustomerVisitsPage />} />
            <Route path="rastreio" element={<SellerTrackingPage />} />
            <Route path="vendas" element={<OrdersPage />} />
            <Route path="vendas/:orderId" element={<OrderDetailPage />} />
            <Route path="insights" element={<InsightsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
