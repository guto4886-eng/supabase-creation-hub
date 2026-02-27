import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Building2 } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtTooltip = (v: number | undefined) => fmt(v ?? 0);
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return fmt(v);
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(262, 83%, 58%)",
  "hsl(330, 81%, 60%)",
  "hsl(173, 58%, 39%)",
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
  created_at: string;
}

interface Obra {
  id: string;
  name: string;
}

export default function FinancialDashboard() {
  const [selectedObra, setSelectedObra] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financial_docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_docs")
        .select("id, description, type, value, status, due_date, payment_date, category, obra_id, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FinancialDoc[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as Obra[];
    },
  });

  const filteredItems = useMemo(() => {
    if (selectedObra === "all") return items;
    if (selectedObra === "none") return items.filter(i => !i.obra_id);
    return items.filter(i => i.obra_id === selectedObra);
  }, [items, selectedObra]);

  // Summary
  const summary = useMemo(() => {
    const receitas = filteredItems.filter(i => i.type === "receita").reduce((s, i) => s + Number(i.value), 0);
    const despesas = filteredItems.filter(i => i.type === "despesa").reduce((s, i) => s + Number(i.value), 0);
    const pendentes = filteredItems.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.value), 0);
    const pagos = filteredItems.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.value), 0);
    return { receitas, despesas, saldo: receitas - despesas, pendentes, pagos, total: filteredItems.length };
  }, [filteredItems]);

  // Monthly data for bar/area chart
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; receitas: number; despesas: number }> = {};
    filteredItems.forEach(item => {
      const date = item.payment_date || item.due_date || item.created_at?.substring(0, 10);
      if (!date) return;
      const key = date.substring(0, 7); // YYYY-MM
      if (!map[key]) map[key] = { month: key, receitas: 0, despesas: 0 };
      if (item.type === "receita") map[key].receitas += Number(item.value);
      else map[key].despesas += Number(item.value);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      saldo: m.receitas - m.despesas,
      label: new Date(m.month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    }));
  }, [filteredItems]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.filter(i => i.type === "despesa").forEach(item => {
      const cat = item.category || "Sem categoria";
      map[cat] = (map[cat] || 0) + Number(item.value);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredItems]);

  // Per-obra comparison (only for "all" view)
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
    return Object.values(map).sort((a, b) => (b.receitas + b.despesas) - (a.receitas + a.despesas));
  }, [items, obras, selectedObra]);

  // Status breakdown
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach(item => {
      const s = item.status === "pago" ? "Pago" : item.status === "pendente" ? "Pendente" : "Cancelado";
      map[s] = (map[s] || 0) + Number(item.value);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredItems]);

  const statusColors: Record<string, string> = {
    Pago: "hsl(142, 71%, 45%)",
    Pendente: "hsl(38, 92%, 50%)",
    Cancelado: "hsl(0, 84%, 60%)",
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Obra selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <label className="text-sm font-medium text-foreground">Visualizar:</label>
        </div>
        <select
          value={selectedObra}
          onChange={e => setSelectedObra(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[250px]"
        >
          <option value="all">📊 Visão Geral (Todas as obras)</option>
          <option value="none">📂 Sem obra vinculada</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>🏗️ {o.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{summary.total} lançamentos</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-xs text-muted-foreground">Receitas</p><p className="text-lg font-bold text-emerald-600">{fmtShort(summary.receitas)}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-xs text-muted-foreground">Despesas</p><p className="text-lg font-bold text-destructive">{fmtShort(summary.despesas)}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`text-lg font-bold ${summary.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtShort(summary.saldo)}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-lg font-bold text-amber-600">{fmtShort(summary.pendentes)}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">Pagos</p><p className="text-lg font-bold text-green-600">{fmtShort(summary.pagos)}</p></div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum lançamento financeiro encontrado</p>
          <p className="text-sm mt-1">Crie lançamentos na aba "Lançamentos" para visualizar os relatórios.</p>
        </div>
      ) : (
        <>
          {/* Monthly Revenue vs Expenses */}
          {monthlyData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Receitas x Despesas por Mês</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Saldo acumulado */}
          {monthlyData.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Saldo Mensal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category pie */}
            {categoryData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status pie */}
            {statusData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Status</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine={false}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={statusColors[entry.name] || COLORS[0]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Per-obra comparison (only in "all" view) */}
          {obraData.length > 1 && selectedObra === "all" && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Comparativo por Obra</h3>
              <ResponsiveContainer width="100%" height={Math.max(250, obraData.length * 50)}>
                <BarChart data={obraData} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
