import { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import HelpButton from "@/components/HelpButton";
import {
  LayoutDashboard, Users, Truck, Building2, FileText,
  DollarSign, ShoppingCart, LogOut, Menu, X, Crown, UserCircle,
  PackageCheck, ChevronDown, ClipboardList, FileSearch, FileBox, Settings, User, Car, HardHat, Database, LineChart
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  badge?: string;
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
  { to: "/central-custos", label: "Central de Custos", icon: LineChart, badge: "NOVO" },
  { to: "/labor", label: "Mão de Obra", icon: HardHat },
  { to: "/budgets", label: "Orçamentos", icon: FileText },
  { to: "/sinapi", label: "Base SINAPI", icon: Database },
  { to: "/quotations", label: "Cotações", icon: ShoppingCart },
  { to: "/fleet", label: "Frota", icon: Car },
  { to: "/financial", label: "Financeiro", icon: DollarSign },
  { to: "/plans", label: "Meu Plano", icon: Crown },
];

const HEADER_HEIGHT = 60;

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile-header", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => location.pathname === c.to) || location.pathname === item.to;

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getExpanded = (item: NavItem) => {
    if (expandedGroups[item.to] !== undefined) return expandedGroups[item.to];
    return isGroupActive(item);
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "";
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-primary border-b border-primary px-5 py-4 flex items-center gap-5 lg:px-8" style={{ height: HEADER_HEIGHT }}>
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-primary-foreground">
          <Menu className="h-5 w-5" />
        </button>

        {/* Left: User indicator */}
        <div className="relative flex items-center" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 text-primary-foreground hover:opacity-80 transition-opacity"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-7 w-7 rounded-full object-cover border border-primary-foreground/30" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground text-xs font-bold">
                {displayName?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <span className="text-base font-medium hidden sm:inline max-w-[160px] truncate">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {userMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={() => { setUserMenuOpen(false); navigate("/companies"); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
              >
                <Building2 className="h-4 w-4" />
                Dados da Empresa
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); navigate("/profile"); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
              >
                <User className="h-4 w-4" />
                Dados do Usuário
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setUserMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Center: App name */}
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xl font-bold text-primary-foreground">Toca a Obra</span>
        </div>

        {/* Right: Notifications */}
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
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-400 to-emerald-500 text-white">
                        {item.badge}
                      </span>
                    )}
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
