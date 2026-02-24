import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import HelpButton from "@/components/HelpButton";
import {
  LayoutDashboard, Users, Truck, Building2, FileText,
  DollarSign, ShoppingCart, LogOut, Menu, X, Crown, UserCircle,
  PackageCheck, ChevronDown, ClipboardList, FileSearch, FileBox
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  children?: { to: string; label: string; icon: any }[];
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/suppliers", label: "Fornecedores", icon: Truck },
  {
    to: "/purchases", label: "Compras", icon: PackageCheck,
    children: [
      { to: "/purchases/requests", label: "Solicitações", icon: ClipboardList },
      { to: "/purchases/quotations", label: "Cotações", icon: FileSearch },
      { to: "/purchases/orders", label: "Ordens de Compra", icon: FileBox },
    ],
  },
  { to: "/obras", label: "Obras", icon: Building2 },
  { to: "/budgets", label: "Orçamentos", icon: FileText },
  { to: "/quotations", label: "Cotações", icon: ShoppingCart },
  { to: "/financial", label: "Financeiro", icon: DollarSign },
  { to: "/profile", label: "Meu Perfil", icon: UserCircle },
  { to: "/plans", label: "Meu Plano", icon: Crown },
];

const HEADER_HEIGHT = 49;

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => location.pathname === c.to) || location.pathname === item.to;

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Auto-expand active group
  const getExpanded = (item: NavItem) => {
    if (expandedGroups[item.to] !== undefined) return expandedGroups[item.to];
    return isGroupActive(item);
  };

  // Find current page label for header
  const currentLabel = (() => {
    for (const item of navItems) {
      if (item.to === location.pathname) return item.label;
      if (item.children) {
        const child = item.children.find(c => c.to === location.pathname);
        if (child) return child.label;
      }
    }
    return "Toca a Obra";
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-primary border-b border-primary px-4 py-3 flex items-center gap-4 lg:px-6" style={{ height: HEADER_HEIGHT }}>
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-primary-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 lg:w-64">
          <Building2 className="h-6 w-6 text-primary-foreground" />
          <span className="text-lg font-bold text-primary-foreground hidden lg:inline">Toca a Obra</span>
        </div>
        <h1 className="text-lg font-semibold text-primary-foreground flex-1">{currentLabel}</h1>
        <NotificationBell />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-sidebar transform transition-transform lg:translate-x-0 lg:static lg:top-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex flex-col h-full">
            <div className="p-5 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-sidebar-primary" />
                <span className="text-lg font-bold text-sidebar-foreground">Toca a Obra</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 space-y-1 pt-3 overflow-y-auto">
              {navItems.map((item) => {
                if (item.children) {
                  const expanded = getExpanded(item);
                  const groupActive = isGroupActive(item);
                  return (
                    <div key={item.to}>
                      <button
                        onClick={() => toggleGroup(item.to)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          groupActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-sidebar-border pl-3">
                          {item.children.map(child => {
                            const childActive = isActive(child.to);
                            return (
                              <Link
                                key={child.to}
                                to={child.to}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  childActive
                                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                }`}
                              >
                                <child.icon className="h-4 w-4" />
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const active = isActive(item.to);
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

        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <HelpButton />
    </div>
  );
}
