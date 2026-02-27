import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Building2, Calendar, Wallet, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return fmt(v);
};

const COLORS = [
  "hsl(217, 91%, 50%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)", "hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)",
  "hsl(330, 81%, 60%)", "hsl(173, 58%, 39%)",
];

interface FinancialDoc {
  id: string;
  description: string;
  type: string;
  value: number;
  status: string;
  due_date: string | null;
  payment_date: string | null;
  category: string | null;
  obra_id: string | null;
  supplier_id: string | null;
  created_at: string;
}

interface Obra { id: string; name: string; }
interface Supplier { id: string; name: string; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function FinancialDashboard() {
  const [selectedObra, setSelectedObra] = useState<string>("all");
  const [period, setPeriod] = useState<"6m" | "12m" | "all">("12m");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financial_docs_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_docs")
        .select("id, description, type, value, status, due_date, payment_date, category, obra_id, supplier_id, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FinancialDoc[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_fin_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as Obra[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_fin_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (selectedObra === "none") filtered = filtered.filter(i => !i.obra_id);
    else if (selectedObra !== "all") filtered = filtered.filter(i => i.obra_id === selectedObra);

    if (period !== "all") {
      const months = period === "6m" ? 6 : 12;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffStr = cutoff.toISOString().substring(0, 10);
      filtered = filtered.filter(i => {
        const d = i.payment_date || i.due_date || i.created_at?.substring(0, 10);
        return d && d >= cutoffStr;
      });
    }
    return filtered;
  }, [items, selectedObra, period]);

  const summary = useMemo(() => {
    const receitas = filteredItems.filter(i => i.type === "receita").reduce((s, i) => s + Number(i.value), 0);
    const despesas = filteredItems.filter(i => i.type === "despesa").reduce((s, i) => s + Number(i.value), 0);
    const pendentes = filteredItems.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.value), 0);
    const pagos = filteredItems.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.value), 0);
    const vencidos = filteredItems.filter(i => {
      if (i.status !== "pendente" || !i.due_date) return false;
      return i.due_date < new Date().toISOString().substring(0, 10);
    }).reduce((s, i) => s + Number(i.value), 0);
    return { receitas, despesas, saldo: receitas - despesas, pendentes, pagos, vencidos, total: filteredItems.length };
  }, [filteredItems]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; receitas: number; despesas: number }> = {};
    filteredItems.forEach(item => {
      const date = item.payment_date || item.due_date || item.created_at?.substring(0, 10);
      if (!date) return;
      const key = date.substring(0, 7);
      if (!map[key]) map[key] = { month: key, receitas: 0, despesas: 0 };
      if (item.type === "receita") map[key].receitas += Number(item.value);
      else map[key].despesas += Number(item.value);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
      let acc = 0;
      return {
        ...m,
        saldo: m.receitas - m.despesas,
        label: new Date(m.month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      };
    });
  }, [filteredItems]);

  const cumulativeData = useMemo(() => {
    let acc = 0;
    return monthlyData.map(m => {
      acc += m.saldo;
      return { ...m, acumulado: acc };
    });
  }, [monthlyData]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.filter(i => i.type === "despesa").forEach(item => {
      const cat = item.category || "Sem categoria";
      map[cat] = (map[cat] || 0) + Number(item.value);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredItems]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach(item => {
      const s = item.status === "pago" ? "Pago" : item.status === "pendente" ? "Pendente" : "Cancelado";
      map[s] = (map[s] || 0) + Number(item.value);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredItems]);

  const typeData = useMemo(() => {
    const rec = filteredItems.filter(i => i.type === "receita").reduce((s, i) => s + Number(i.value), 0);
    const desp = filteredItems.filter(i => i.type === "despesa").reduce((s, i) => s + Number(i.value), 0);
    return [
      { name: "Receitas", value: rec },
      { name: "Despesas", value: desp },
    ].filter(d => d.value > 0);
  }, [filteredItems]);

  const obraData = useMemo(() => {
    if (selectedObra !== "all") return [];
    const map: Record<string, { name: string; receitas: number; despesas: number }> = {};
    items.forEach(item => {
      const obraId = item.obra_id || "_sem_obra";
      const obraName = item.obra_id ? (obras.find(o => o.id === item.obra_id)?.name || "Obra") : "Sem obra";
      if (!map[obraId]) map[obraId] = { name: obraName, receitas: 0, despesas: 0 };
      if (item.type === "receita") map[obraId].receitas += Number(item.value);
      else map[obraId].despesas += Number(item.value);
    });
    return Object.values(map).sort((a, b) => (b.receitas + b.despesas) - (a.receitas + a.despesas)).slice(0, 10);
  }, [items, obras, selectedObra]);

  const topSuppliers = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filteredItems.filter(i => i.type === "despesa" && i.supplier_id).forEach(item => {
      const sid = item.supplier_id!;
      const sName = suppliers.find(s => s.id === sid)?.name || "Fornecedor";
      if (!map[sid]) map[sid] = { name: sName, total: 0 };
      map[sid].total += Number(item.value);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [filteredItems, suppliers]);

  const statusColors: Record<string, string> = {
    Pago: "hsl(142, 71%, 45%)",
    Pendente: "hsl(38, 92%, 50%)",
    Cancelado: "hsl(0, 84%, 60%)",
  };

  const typeColors: Record<string, string> = {
    Receitas: "hsl(142, 71%, 45%)",
    Despesas: "hsl(0, 84%, 60%)",
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <select
            value={selectedObra}
            onChange={e => setSelectedObra(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[220px]"
          >
            <option value="all">📊 Visão Geral</option>
            <option value="none">📂 Sem obra vinculada</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>🏗️ {o.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
          {([["6m", "6 meses"], ["12m", "12 meses"], ["all", "Tudo"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === val ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{summary.total} lançamentos</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Receitas" value={summary.receitas} color="text-emerald-600" bg="bg-emerald-500/10" />
        <SummaryCard icon={<TrendingDown className="h-5 w-5" />} label="Despesas" value={summary.despesas} color="text-destructive" bg="bg-destructive/10" />
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Saldo" value={summary.saldo} color={summary.saldo >= 0 ? "text-emerald-600" : "text-destructive"} bg="bg-primary/10" />
        <SummaryCard icon={<Wallet className="h-5 w-5" />} label="Pendentes" value={summary.pendentes} color="text-amber-600" bg="bg-amber-500/10" />
        <SummaryCard icon={<CreditCard className="h-5 w-5" />} label="Pagos" value={summary.pagos} color="text-emerald-600" bg="bg-emerald-500/10" />
        <SummaryCard icon={<Calendar className="h-5 w-5" />} label="Vencidos" value={summary.vencidos} color="text-destructive" bg="bg-destructive/10" />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum lançamento financeiro encontrado</p>
          <p className="text-sm mt-1">Crie lançamentos na aba "Lançamentos" para visualizar os relatórios.</p>
        </div>
      ) : (
        <>
          {/* Monthly bar chart */}
          {monthlyData.length > 0 && (
            <ChartCard title="Receitas x Despesas por Mês">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 84%, 60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Cumulative balance */}
          {cumulativeData.length > 1 && (
            <ChartCard title="Saldo Acumulado">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--primary))" fill="url(#gradAcum)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Pie charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {typeData.length > 0 && (
              <ChartCard title="Receitas x Despesas">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {typeData.map((entry) => (
                        <Cell key={entry.name} fill={typeColors[entry.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {categoryData.length > 0 && (
              <ChartCard title="Despesas por Categoria">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {statusData.length > 0 && (
              <ChartCard title="Distribuição por Status">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={statusColors[entry.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Top suppliers table */}
          {topSuppliers.length > 0 && (
            <ChartCard title="Top Fornecedores (Despesas)">
              <div className="space-y-2">
                {topSuppliers.map((s, i) => {
                  const maxVal = topSuppliers[0]?.total || 1;
                  const pct = (s.total / maxVal) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                          <span className="text-sm font-semibold text-foreground ml-2">{fmtShort(s.total)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          )}

          {/* Per-obra comparison */}
          {obraData.length > 1 && selectedObra === "all" && (
            <ChartCard title="Comparativo por Obra">
              <ResponsiveContainer width="100%" height={Math.max(250, obraData.length * 50)}>
                <BarChart data={obraData} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 84%, 60%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-base font-bold ${color} truncate`}>{fmtShort(value)}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}
