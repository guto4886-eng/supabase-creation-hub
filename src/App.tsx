import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import PurchaseRequests from "@/pages/PurchaseRequests";
import PurchaseQuotations from "@/pages/PurchaseQuotations";
import PurchaseOrders from "@/pages/PurchaseOrders";
import Obras from "@/pages/Obras";
import Budgets from "@/pages/Budgets";
import Quotations from "@/pages/Quotations";
import Financial from "@/pages/Financial";
import Profile from "@/pages/Profile";
import Plans from "@/pages/Plans";
import Companies from "@/pages/Companies";
import Fleet from "@/pages/Fleet";
import Labor from "@/pages/Labor";
import Sinapi from "@/pages/Sinapi";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Toaster position="top-right" richColors />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="clients" element={<Clients />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="purchases/requests" element={<PurchaseRequests />} />
                <Route path="purchases/quotations" element={<PurchaseQuotations />} />
                <Route path="purchases/orders" element={<PurchaseOrders />} />
                <Route path="obras" element={<Obras />} />
                <Route path="labor" element={<Labor />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="sinapi" element={<Sinapi />} />
                <Route path="quotations" element={<Quotations />} />
                <Route path="financial" element={<Financial />} />
                <Route path="profile" element={<Profile />} />
                <Route path="companies" element={<Companies />} />
                <Route path="fleet" element={<Fleet />} />
                <Route path="plans" element={<Plans />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
