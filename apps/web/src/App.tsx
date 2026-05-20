import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLogo } from "./components/layout/AppLogo";
import { PublicAuthLayout } from "./components/layout/PublicAuthLayout";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerVisitsPage } from "./pages/CustomerVisitsPage";
import { CommissionAdminPage } from "./pages/CommissionAdminPage";
import { DashboardHome } from "./pages/DashboardHome";
import { DashboardLayout } from "./pages/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PriceTablesPage } from "./pages/PriceTablesPage";
import { ProductCategoriesPage } from "./pages/ProductCategoriesPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SellerProductsPage } from "./pages/SellerProductsPage";
import { SellersPage } from "./pages/SellersPage";
import { SellerTrackingPage } from "./pages/SellerTrackingPage";

const qc = new QueryClient();

function SellerNotice() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:h-16 md:px-6">
          <AppLogo to="/login" />
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="max-w-md text-center text-slate-700">
          O painel web é apenas para administradores. Vendedores devem usar o aplicativo mobile.
        </p>
      </div>
    </div>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Carregando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") {
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
          !loading && user?.role === "ADMIN" ? (
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
          <AdminGate>
            <DashboardLayout />
          </AdminGate>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="tabelas-preco" element={<PriceTablesPage />} />
        <Route path="produtos/categorias" element={<ProductCategoriesPage />} />
        <Route path="produtos/novo" element={<ProductFormPage />} />
        <Route path="produtos/:productId/editar" element={<ProductFormPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="comissao" element={<CommissionAdminPage />} />
        <Route path="vendedores" element={<SellersPage />} />
        <Route path="vendedores/:sellerId/produtos" element={<SellerProductsPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="visitas" element={<CustomerVisitsPage />} />
        <Route path="rastreio" element={<SellerTrackingPage />} />
        <Route path="vendas" element={<OrdersPage />} />
        <Route path="vendas/:orderId" element={<OrderDetailPage />} />
        <Route path="notificacoes" element={<NotificationsPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
