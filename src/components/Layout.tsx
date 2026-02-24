import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import HelpButton from "@/components/HelpButton";
import {
  LayoutDashboard, Users, Truck, Building2, FileText,
  DollarSign, ShoppingCart, LogOut, Menu, X, ChevronDown, Crown, UserCircle
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/suppliers", label: "Fornecedores", icon: Truck },
  { to: "/obras", label: "Obras", icon: Building2 },
  { to: "/budgets", label: "Orçamentos", icon: FileText },
  { to: "/quotations", label: "Cotações", icon: ShoppingCart },
  { to: "/financial", label: "Financeiro", icon: DollarSign },
  { to: "/profile", label: "Meu Perfil", icon: UserCircle },
  { to: "/plans", label: "Meu Plano", icon: Crown },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-sidebar-primary" />
              <span className="text-lg font-bold text-sidebar-foreground">Toca a Obra</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-sm font-bold">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-sidebar-foreground truncate">{user?.email}</p>
              </div>
              <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-primary backdrop-blur border-b border-primary px-4 py-3 flex items-center gap-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-primary-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-primary-foreground flex-1">
            {navItems.find((n) => n.to === location.pathname)?.label ?? "Toca a Obra"}
          </h1>
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
      <HelpButton />
    </div>
  );
}
