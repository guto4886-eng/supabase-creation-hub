import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar, Legend,
} from "recharts";
import {
  Building2, Users, Truck, DollarSign, TrendingUp, TrendingDown,
  FileText, ShoppingCart, ClipboardList, AlertTriangle, CheckCircle2,
  Clock, Wallet, ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return fmt(v);
};

const NEON = {
  cyan: "#00f0ff",
  green: "#00ff88",
  pink: "#ff00aa",
  orange: "#ff8800",
  purple: "#aa55ff",
  blue: "#4488ff",
  yellow: "#ffee00",
  red: "#ff3355",
};

const NeonTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 shadow-2xl border border-white/10" style={{ background: "rgba(15,15,30,0.95)", backdropFilter: "blur(12px)" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#aab" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color || NEON.cyan }}>
          {p.name}: {typeof p.value === "number" ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  // ── Data queries ──
  const { data: obrasData = [] } = useQuery({
    queryKey: ["dash-obras"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, name, status, total_budget, start_date, expected_end_date, active");
      return data ?? [];
    },
  });

  const { data: clients = 0 } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: suppliersCount = 0 } = useQuery({
    queryKey: ["dash-suppliers"],
    queryFn: async () => {
      const { count } = await supabase.from("suppliers").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: financialData = [] } = useQuery({
    queryKey: ["dash-financial"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_docs").select("type, value, status, due_date, payment_date, category, obra_id, created_at");
      return data ?? [];
    },
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["dash-po"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("id, status, total_value, created_at");
      return data ?? [];
    },
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["dash-quot"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_quotations").select("id, status, total_value, created_at");
      return data ?? [];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["dash-budgets"],
    queryFn: async () => {
      const { data } = await supabase.from("budgets").select("id, status, total_value");
      return data ?? [];
    },
  });

  // ── Computed ──
  const fin = useMemo(() => {
    const receitas = financialData.filter(d => d.type === "receita").reduce((s, d) => s + Number(d.value), 0);
    const despesas = financialData.filter(d => d.type === "despesa").reduce((s, d) => s + Number(d.value), 0);
    const pendentes = financialData.filter(d => d.status === "pendente").reduce((s, d) => s + Number(d.value), 0);
    const pagos = financialData.filter(d => d.status === "pago").reduce((s, d) => s + Number(d.value), 0);
    const today = new Date().toISOString().substring(0, 10);
    const vencidos = financialData.filter(d => d.status === "pendente" && d.due_date && d.due_date < today).reduce((s, d) => s + Number(d.value), 0);
    const vencidosCount = financialData.filter(d => d.status === "pendente" && d.due_date && d.due_date < today).length;
    return { receitas, despesas, saldo: receitas - despesas, pendentes, pagos, vencidos, vencidosCount, total: financialData.length };
  }, [financialData]);

  const obraStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    obrasData.forEach(o => {
      const s = o.status || "planejamento";
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    return Object.entries(byStatus).map(([name, value]) => ({ name: statusLabel(name), value }));
  }, [obrasData]);

  const monthlyFinancial = useMemo(() => {
    const map: Record<string, { month: string; receitas: number; despesas: number }> = {};
    financialData.forEach(item => {
      const date = item.payment_date || item.due_date || item.created_at?.substring(0, 10);
      if (!date) return;
      const key = date.substring(0, 7);
      if (!map[key]) map[key] = { month: key, receitas: 0, despesas: 0 };
      if (item.type === "receita") map[key].receitas += Number(item.value);
      else map[key].despesas += Number(item.value);
    });
    const sorted = Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    let acc = 0;
    return sorted.map(m => {
      acc += m.receitas - m.despesas;
      return {
        ...m,
        saldo: m.receitas - m.despesas,
        acumulado: acc,
        label: new Date(m.month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      };
    });
  }, [financialData]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    financialData.filter(i => i.type === "despesa").forEach(item => {
      const cat = item.category || "Outros";
      map[cat] = (map[cat] || 0) + Number(item.value);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [financialData]);

  const poStats = useMemo(() => {
    const total = purchaseOrders.length;
    const approved = purchaseOrders.filter(p => p.status === "aprovada" || p.status === "entregue").length;
    const pending = purchaseOrders.filter(p => p.status === "pendente" || p.status === "rascunho").length;
    const totalValue = purchaseOrders.reduce((s, p) => s + Number(p.total_value || 0), 0);
    return { total, approved, pending, totalValue };
  }, [purchaseOrders]);

  const budgetStats = useMemo(() => {
    const total = budgets.length;
    const totalValue = budgets.reduce((s, b) => s + Number(b.total_value || 0), 0);
    return { total, totalValue };
  }, [budgets]);

  const NEON_COLORS = [NEON.cyan, NEON.green, NEON.pink, NEON.orange, NEON.purple, NEON.blue];

  return (
    <div className="space-y-5 p-4 lg:p-6 min-h-screen" style={{ background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)" }}>
      {/* Header */}
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Painel de Controle
        </h2>
        <p className="text-sm text-muted-foreground">Visão completa do sistema de gestão de obras</p>
      </div>

      {/* KPI Cards Row 1 - Counts */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <NeonCard icon={<Building2 />} label="Obras" value={obrasData.length} neon={NEON.cyan} />
        <NeonCard icon={<Users />} label="Clientes" value={clients} neon={NEON.green} />
        <NeonCard icon={<Truck />} label="Fornecedores" value={suppliersCount} neon={NEON.orange} />
        <NeonCard icon={<ShoppingCart />} label="Ordens Compra" value={poStats.total} neon={NEON.purple} />
        <NeonCard icon={<ClipboardList />} label="Cotações" value={quotations.length} neon={NEON.blue} />
        <NeonCard icon={<FileText />} label="Orçamentos" value={budgetStats.total} neon={NEON.pink} />
      </div>

      {/* KPI Cards Row 2 - Financial */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <NeonFinCard icon={<TrendingUp />} label="Receitas" value={fin.receitas} neon={NEON.green} arrow="up" />
        <NeonFinCard icon={<TrendingDown />} label="Despesas" value={fin.despesas} neon={NEON.red} arrow="down" />
        <NeonFinCard icon={<DollarSign />} label="Saldo" value={fin.saldo} neon={fin.saldo >= 0 ? NEON.green : NEON.red} arrow={fin.saldo >= 0 ? "up" : "down"} />
        <NeonFinCard icon={<Clock />} label="Pendentes" value={fin.pendentes} neon={NEON.yellow} />
        <NeonFinCard icon={<CheckCircle2 />} label="Pagos" value={fin.pagos} neon={NEON.green} />
        <NeonFinCard icon={<AlertTriangle />} label={`Vencidos (${fin.vencidosCount})`} value={fin.vencidos} neon={NEON.red} alert />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        {/* Monthly Financial */}
        <div className="lg:col-span-2">
          <GlassCard title="Fluxo Financeiro Mensal">
            {monthlyFinancial.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyFinancial} barGap={4}>
                  <defs>
                    <linearGradient id="neonGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NEON.green} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={NEON.green} stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="neonRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NEON.red} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={NEON.red} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<NeonTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="url(#neonGreen)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="url(#neonRed)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </GlassCard>
        </div>

        {/* Obras Status Pie */}
        <GlassCard title="Status das Obras">
          {obraStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <defs>
                  {NEON_COLORS.map((c, i) => (
                    <filter key={i} id={`glow${i}`}>
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  ))}
                </defs>
                <Pie data={obraStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} strokeWidth={0}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {obraStats.map((_, i) => (
                    <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} style={{ filter: `drop-shadow(0 0 6px ${NEON_COLORS[i % NEON_COLORS.length]}80)` }} />
                  ))}
                </Pie>
                <Tooltip content={<NeonTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </GlassCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        {/* Saldo Acumulado */}
        <div className="lg:col-span-2">
          <GlassCard title="Evolução do Saldo Acumulado">
            {monthlyFinancial.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyFinancial}>
                  <defs>
                    <linearGradient id="neonCyanArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={NEON.cyan} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={NEON.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<NeonTooltip />} />
                  <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke={NEON.cyan} fill="url(#neonCyanArea)" strokeWidth={3} dot={false}
                    style={{ filter: `drop-shadow(0 0 8px ${NEON.cyan}80)` }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </GlassCard>
        </div>

        {/* Despesas por Categoria */}
        <GlassCard title="Despesas por Categoria">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={3} strokeWidth={0}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} style={{ filter: `drop-shadow(0 0 5px ${NEON_COLORS[i % NEON_COLORS.length]}60)` }} />
                  ))}
                </Pie>
                <Tooltip content={<NeonTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </GlassCard>
      </div>

      {/* Bottom: Purchase & Budget summary + Obras list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in" style={{ animationDelay: "0.5s" }}>
        {/* Purchase & Quotation Summary */}
        <GlassCard title="Compras & Cotações">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Ordens de Compra" value={poStats.total} sub={`${poStats.approved} aprovadas`} neon={NEON.purple} />
            <MiniStat label="Valor Total OCs" value={fmtShort(poStats.totalValue)} sub={`${poStats.pending} pendentes`} neon={NEON.orange} />
            <MiniStat label="Cotações" value={quotations.length} sub={`${quotations.filter(q => q.status === "rascunho").length} rascunhos`} neon={NEON.blue} />
            <MiniStat label="Orçamentos" value={budgetStats.total} sub={fmtShort(budgetStats.totalValue)} neon={NEON.pink} />
          </div>
        </GlassCard>

        {/* Recent Obras */}
        <GlassCard title="Obras Recentes">
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {obrasData.slice(0, 8).map((obra, i) => (
              <div key={obra.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{obra.name}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel(obra.status)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {obra.total_budget ? (
                    <span className="text-xs font-semibold" style={{ color: NEON.cyan }}>{fmtShort(Number(obra.total_budget))}</span>
                  ) : null}
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(obra.status), boxShadow: `0 0 6px ${statusColor(obra.status)}` }} />
                </div>
              </div>
            ))}
            {obrasData.length === 0 && <EmptyState />}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ── Helper Components ──

function NeonCard({ icon, label, value, neon }: { icon: React.ReactNode; label: string; value: number | string; neon: string }) {
  return (
    <div className="relative bg-card border border-border rounded-xl p-4 overflow-hidden hover:scale-[1.02] transition-transform duration-200 group">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: `inset 0 0 30px ${neon}15, 0 0 15px ${neon}10` }} />
      <div className="flex items-center gap-3 relative z-10">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${neon}18`, color: neon }}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function NeonFinCard({ icon, label, value, neon, arrow, alert }: { icon: React.ReactNode; label: string; value: number; neon: string; arrow?: "up" | "down"; alert?: boolean }) {
  return (
    <div className={`relative bg-card border rounded-xl p-4 overflow-hidden hover:scale-[1.02] transition-transform duration-200 ${alert ? "border-destructive/40" : "border-border"}`}>
      {alert && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: neon, boxShadow: `0 0 10px ${neon}` }} />}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${neon}18`, color: neon }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div className="flex items-center gap-1">
            <p className="text-base font-bold text-foreground truncate">{fmtShort(value)}</p>
            {arrow === "up" && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" style={{ color: NEON.green }} />}
            {arrow === "down" && <ArrowDownRight className="h-3.5 w-3.5 shrink-0" style={{ color: NEON.red }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ boxShadow: `0 0 6px hsl(var(--primary))` }} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function MiniStat({ label, value, sub, neon }: { label: string; value: string | number; sub: string; neon: string }) {
  return (
    <div className="rounded-lg border border-border/50 p-3 hover:border-primary/20 transition-colors">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
      <p className="text-xs mt-1" style={{ color: neon }}>{sub}</p>
    </div>
  );
}

function EmptyState() {
  return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sem dados disponíveis</div>;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    planejamento: "Planejamento", em_andamento: "Em Andamento", concluida: "Concluída",
    paralisada: "Paralisada", cancelada: "Cancelada",
  };
  return map[s] || s;
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    planejamento: NEON.blue, em_andamento: NEON.green, concluida: NEON.cyan,
    paralisada: NEON.orange, cancelada: NEON.red,
  };
  return map[s] || NEON.purple;
}
