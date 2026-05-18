import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatBRL, COST_TYPES, PAYMENT_METHODS, UNITS, normalizeTags, DEFAULT_PHASES, phaseColor, phaseIcon, type Phase } from "@/utils/ccTags";
import {
  ArrowLeft, Plus, Download, FileText, Wallet, TrendingUp, Target, AlertTriangle,
  Activity, Trash2, Copy, Pencil, Upload, Search, Calendar, Tag, Users, Package,
  LineChart as LineIcon, FileBarChart, FolderOpen, Settings as SettingsIcon, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Entry = {
  id: string;
  user_id: string;
  obra_id: string;
  tipo: string;
  nome_item: string;
  categoria: string | null;
  tags: string[];
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  data: string;
  forma_pagamento: string | null;
  fornecedor: string | null;
  funcionario_id: string | null;
  observacao: string | null;
  comprovante_url: string | null;
  fase: string | null;
  created_at: string;
};

type Employee = {
  id: string;
  nome: string;
  funcao: string | null;
  valor_diaria: number;
  valor_mensal: number;
  data_entrada: string | null;
  status: string;
};

type Settings = {
  id?: string;
  orcamento_previsto: number;
  meta_margem: number;
  alerta_estouro_pct: number;
  obra_publica: boolean;
  imagem_url: string | null;
};

type TabKey =
  | "visao" | "custos" | "funcionarios" | "materiais"
  | "analytics" | "relatorios" | "arquivos" | "config";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "visao", label: "Visão Geral", icon: Activity },
  { key: "custos", label: "Custos", icon: Wallet },
  { key: "funcionarios", label: "Funcionários", icon: Users },
  { key: "materiais", label: "Materiais", icon: Package },
  { key: "analytics", label: "Analytics", icon: LineIcon },
  { key: "relatorios", label: "Relatórios", icon: FileBarChart },
  { key: "arquivos", label: "Arquivos", icon: FolderOpen },
  { key: "config", label: "Configurações", icon: SettingsIcon },
];

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

export default function CentralCustosObra() {
  const { obraId = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("visao");

  const { data: obra } = useQuery({
    queryKey: ["cc-obra", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_projects" as any)
        .select("id,nome,data_inicio,imagem_url")
        .eq("id", obraId)
        .maybeSingle();
      if (!data) return null;
      const d = data as any;
      return {
        id: d.id,
        name: d.nome,
        start_date: d.data_inicio,
        imagem_url: d.imagem_url,
        city: null,
        state: null,
        expected_end_date: null,
        total_budget: 0,
      } as any;
    },
    enabled: !!obraId,
  });

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["cc-entries", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_cost_entries" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("data", { ascending: false });
      return (data || []) as any;
    },
    enabled: !!obraId,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["cc-employees", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_employees" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("nome");
      return (data || []) as any;
    },
    enabled: !!obraId,
  });

  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["cc-settings", obraId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_obra_settings" as any)
        .select("*")
        .eq("obra_id", obraId)
        .maybeSingle();
      return (data as any) || null;
    },
    enabled: !!obraId,
  });

  const { data: customPhases = [] } = useQuery<Phase[]>({
    queryKey: ["cc-phases", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_phases" as any)
        .select("nome,cor,icone")
        .order("nome");
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const allPhases: Phase[] = useMemo(
    () => [...DEFAULT_PHASES, ...customPhases.filter((c) => !DEFAULT_PHASES.some((d) => d.nome.toLowerCase() === c.nome.toLowerCase()))],
    [customPhases]
  );

  const orcamentoPrevisto = Number(settings?.orcamento_previsto || obra?.total_budget || 0);
  const gastoTotal = entries.reduce((s, e) => s + Number(e.valor_total || 0), 0);
  const saldo = orcamentoPrevisto - gastoTotal;
  const pctConsumido = orcamentoPrevisto > 0 ? (gastoTotal / orcamentoPrevisto) * 100 : 0;
  const margem = orcamentoPrevisto > 0 ? ((saldo / orcamentoPrevisto) * 100) : 0;
  const saude: "saudavel" | "atencao" | "risco" =
    pctConsumido >= 90 ? "risco" : pctConsumido >= 70 ? "atencao" : "saudavel";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cc-entries", obraId] });
    qc.invalidateQueries({ queryKey: ["cc-employees", obraId] });
    qc.invalidateQueries({ queryKey: ["cc-settings", obraId] });
    qc.invalidateQueries({ queryKey: ["cc-phases"] });
    qc.invalidateQueries({ queryKey: ["cc-entries-all"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/central-custos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Central de Custos
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{obra?.name || "Obra"}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {(obra?.city || obra?.state) && (
              <span>{[obra?.city, obra?.state].filter(Boolean).join(" / ")}</span>
            )}
            {obra?.start_date && <span>Início: {new Date(obra.start_date).toLocaleDateString("pt-BR")}</span>}
            {obra?.expected_end_date && <span>Previsão: {new Date(obra.expected_end_date).toLocaleDateString("pt-BR")}</span>}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                saude === "saudavel" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : saude === "atencao" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}
            >
              {saude === "saudavel" ? "Saudável" : saude === "atencao" ? "Atenção" : "Risco"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-2xl p-1.5 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="cc-tab-pill"
                    className="absolute inset-0 bg-primary rounded-xl shadow-md"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "visao" && (
            <VisaoGeralTab
              entries={entries} orcamentoPrevisto={orcamentoPrevisto} gastoTotal={gastoTotal}
              saldo={saldo} margem={margem} pctConsumido={pctConsumido} saude={saude}
              obraId={obraId} userId={user?.id || ""} employees={employees} onSaved={refresh}
              phases={allPhases}
            />
          )}
          {tab === "custos" && (
            <CustosTab entries={entries} obraId={obraId} userId={user?.id || ""} onChanged={refresh} phases={allPhases} />
          )}
          {tab === "funcionarios" && (
            <FuncionariosTab employees={employees} entries={entries} obraId={obraId} userId={user?.id || ""} onChanged={refresh} />
          )}
          {tab === "materiais" && <MateriaisTab entries={entries} />}
          {tab === "analytics" && (
            <AnalyticsTab entries={entries} orcamentoPrevisto={orcamentoPrevisto} gastoTotal={gastoTotal} pctConsumido={pctConsumido} saude={saude} phases={allPhases} />
          )}
          {tab === "relatorios" && (
            <RelatoriosTab entries={entries} obra={obra} orcamentoPrevisto={orcamentoPrevisto} gastoTotal={gastoTotal} phases={allPhases} />
          )}
          {tab === "arquivos" && <ArquivosTab obraId={obraId} userId={user?.id || ""} />}
          {tab === "config" && (
            <ConfigTab obraId={obraId} userId={user?.id || ""} settings={settings} onSaved={refresh} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============== VISÃO GERAL ============== */
function VisaoGeralTab({
  entries, orcamentoPrevisto, gastoTotal, saldo, margem, pctConsumido, saude,
  obraId, userId, employees, onSaved, phases,
}: any) {
  // Evolução por mês
  const evolution = useMemo(() => {
    const buckets: Record<string, number> = {};
    [...entries].reverse().forEach((e: Entry) => {
      const k = e.data?.slice(0, 7) || "";
      buckets[k] = (buckets[k] || 0) + Number(e.valor_total || 0);
    });
    let acc = 0;
    return Object.keys(buckets).sort().map((k) => {
      acc += buckets[k];
      return { mes: k.slice(5) + "/" + k.slice(2, 4), valor: buckets[k], acumulado: acc };
    });
  }, [entries]);

  // Categorias
  const categorias = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: Entry) => {
      const k = e.tipo || "outros";
      map[k] = (map[k] || 0) + Number(e.valor_total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [entries]);

  // Previsão final
  const previsaoFinal = useMemo(() => {
    if (entries.length === 0) return 0;
    const meses = Math.max(1, new Set(entries.map((e: Entry) => e.data?.slice(0, 7))).size);
    const media = gastoTotal / meses;
    return gastoTotal + media * 3;
  }, [entries, gastoTotal]);

  const kpis = [
    { icon: Target, label: "Orçamento Previsto", value: orcamentoPrevisto, color: "from-indigo-500/15 to-transparent", ico: "text-indigo-500" },
    { icon: Wallet, label: "Gasto Total", value: gastoTotal, color: "from-rose-500/15 to-transparent", ico: "text-rose-500" },
    { icon: TrendingUp, label: "Saldo Disponível", value: saldo, color: "from-emerald-500/15 to-transparent", ico: "text-emerald-500" },
    { icon: AlertTriangle, label: "Previsão Final", value: previsaoFinal, color: "from-amber-500/15 to-transparent", ico: "text-amber-500" },
    { icon: Activity, label: "Margem", value: margem, fmt: "pct", color: "from-blue-500/15 to-transparent", ico: "text-blue-500" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${k.color}`} />
            <div className="relative">
              <div className={`inline-flex p-2 rounded-xl bg-background/60 ${k.ico}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{k.label}</p>
              <p className="text-lg lg:text-xl font-bold mt-1 tabular-nums">
                {k.fmt === "pct" ? `${k.value.toFixed(1)}%` : formatBRL(k.value)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Evolução dos gastos</h3>
          <p className="text-xs text-muted-foreground mb-4">Mensal e acumulado</p>
          <div className="h-64">
            {evolution.length === 0 ? (
              <EmptyChart label="Sem lançamentos" />
            ) : (
              <ResponsiveContainer>
                <AreaChart data={evolution}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="acumulado" stroke="#6366f1" fill="url(#grad1)" strokeWidth={2} />
                  <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Donut categorias */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Gastos por categoria</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição</p>
          <div className="h-64">
            {categorias.length === 0 ? (
              <EmptyChart label="Sem dados" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categorias} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categorias.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1 mt-2 text-xs">
            {categorias.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 capitalize">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {c.name}
                </span>
                <span className="font-medium tabular-nums">{formatBRL(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline lançamentos */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-4">Lançamentos recentes</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento ainda.</p>
          ) : (
            <ul className="space-y-2">
              {entries.slice(0, 8).map((e: Entry) => {
                const type = COST_TYPES.find((t) => t.value === e.tipo);
                return (
                  <li key={e.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-lg">
                      {type?.icon || "📌"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.nome_item}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {type?.label} • {new Date(e.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-sm">{formatBRL(e.valor_total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick add */}
        <QuickAddCost obraId={obraId} userId={userId} employees={employees} onSaved={onSaved} />
      </div>
    </div>
  );
}

/* ============== QUICK ADD ============== */
function QuickAddCost({ obraId, userId, employees, onSaved, editing, onCancelEdit }: any) {
  const [form, setForm] = useState({
    tipo: "material", nome_item: "", categoria: "", quantidade: 1, unidade: "un",
    valor_unitario: 0, data: new Date().toISOString().slice(0, 10),
    forma_pagamento: "", fornecedor: "", funcionario_id: "", observacao: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        tipo: editing.tipo, nome_item: editing.nome_item, categoria: editing.categoria || "",
        quantidade: editing.quantidade, unidade: editing.unidade,
        valor_unitario: editing.valor_unitario, data: editing.data,
        forma_pagamento: editing.forma_pagamento || "", fornecedor: editing.fornecedor || "",
        funcionario_id: editing.funcionario_id || "", observacao: editing.observacao || "",
      });
    }
  }, [editing]);

  const valorTotal = Number(form.quantidade || 0) * Number(form.valor_unitario || 0);

  const save = async () => {
    if (!form.nome_item) { toast.error("Informe o nome do item"); return; }
    setSaving(true);
    try {
      let comprovante_url: string | null = editing?.comprovante_url || null;
      if (file) {
        const path = `${userId}/${obraId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("cc-comprovantes").upload(path, file);
        if (error) throw error;
        comprovante_url = path;
      }
      const payload: any = {
        user_id: userId, obra_id: obraId,
        tipo: form.tipo, nome_item: form.nome_item,
        categoria: form.categoria || null,
        tags: normalizeTags(form.nome_item, form.categoria),
        quantidade: Number(form.quantidade), unidade: form.unidade,
        valor_unitario: Number(form.valor_unitario), valor_total: valorTotal,
        data: form.data,
        forma_pagamento: form.forma_pagamento || null,
        fornecedor: form.fornecedor || null,
        funcionario_id: form.funcionario_id || null,
        observacao: form.observacao || null,
        comprovante_url,
      };
      if (editing) {
        const { error } = await supabase.from("cc_cost_entries" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Custo atualizado");
      } else {
        const { error } = await supabase.from("cc_cost_entries" as any).insert(payload);
        if (error) throw error;
        toast.success("Custo lançado");
      }
      setForm({ ...form, nome_item: "", quantidade: 1, valor_unitario: 0, observacao: "" });
      setFile(null);
      onSaved?.();
      onCancelEdit?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sticky top-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <h3 className="font-semibold">{editing ? "Editar custo" : "Lançamento rápido"}</h3>
      </div>
      <div className="space-y-2.5">
        <select className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <input className={inputCls} placeholder="Nome do item" value={form.nome_item} onChange={(e) => setForm({ ...form, nome_item: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" className={inputCls} placeholder="Qtd" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} />
          <select className={inputCls} value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input type="number" step="0.01" className={inputCls} placeholder="Vl. un." value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: Number(e.target.value) })} />
        </div>
        <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold text-primary tabular-nums">{formatBRL(valorTotal)}</span>
        </div>
        <input type="date" className={inputCls} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        <select className={inputCls} value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>
          <option value="">Forma de pagamento</option>
          {PAYMENT_METHODS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <input className={inputCls} placeholder="Fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
        {form.tipo === "funcionario" && employees.length > 0 && (
          <select className={inputCls} value={form.funcionario_id} onChange={(e) => setForm({ ...form, funcionario_id: e.target.value })}>
            <option value="">Funcionário</option>
            {employees.map((emp: Employee) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
          </select>
        )}
        <textarea className={`${inputCls} h-16 py-2`} placeholder="Observação" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 text-sm">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground truncate">{file?.name || "Anexar comprovante"}</span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? "Salvando..." : editing ? "Atualizar" : "Salvar Custo"}
        </button>
        {editing && (
          <button onClick={onCancelEdit} className="w-full py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Cancelar edição
          </button>
        )}
      </div>
    </div>
  );
}

/* ============== CUSTOS ============== */
function CustosTab({ entries, obraId, userId, onChanged }: any) {
  const [search, setSearch] = useState("");
  const [tipoF, setTipoF] = useState("todos");
  const [editing, setEditing] = useState<Entry | null>(null);

  const filtered = entries.filter((e: Entry) => {
    if (search && !`${e.nome_item} ${e.fornecedor || ""} ${e.categoria || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (tipoF !== "todos" && e.tipo !== tipoF) return false;
    return true;
  });

  const remove = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    const { error } = await supabase.from("cc_cost_entries" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    onChanged();
  };

  const duplicate = async (e: Entry) => {
    const { id, created_at, ...rest } = e as any;
    const { error } = await supabase.from("cc_cost_entries" as any).insert({ ...rest, user_id: userId, obra_id: obraId });
    if (error) return toast.error(error.message);
    toast.success("Duplicado");
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar custo..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm" />
          </div>
          <select value={tipoF} onChange={(e) => setTipoF(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-background text-sm">
            <option value="todos">Todos tipos</option>
            {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Nenhum custo encontrado.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((e: Entry) => {
              const type = COST_TYPES.find((t) => t.value === e.tipo);
              return (
                <li key={e.id} className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-shadow flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-xl">{type?.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{e.nome_item}</p>
                      {e.tags?.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">#{t}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {type?.label} • {new Date(e.data).toLocaleDateString("pt-BR")}
                      {e.fornecedor && ` • ${e.fornecedor}`}
                      {e.forma_pagamento && ` • ${e.forma_pagamento}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatBRL(e.valor_total)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(e)} className="p-1.5 rounded-lg hover:bg-muted" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => duplicate(e)} className="p-1.5 rounded-lg hover:bg-muted" title="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <QuickAddCost obraId={obraId} userId={userId} employees={[]} onSaved={onChanged} editing={editing} onCancelEdit={() => setEditing(null)} />
    </div>
  );
}

/* ============== FUNCIONÁRIOS ============== */
function FuncionariosTab({ employees, entries, obraId, userId, onChanged }: any) {
  const [form, setForm] = useState({ nome: "", funcao: "", valor_diaria: 0, valor_mensal: 0, data_entrada: new Date().toISOString().slice(0, 10), status: "ativo" });
  const inputCls = "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm";

  const save = async () => {
    if (!form.nome) return toast.error("Informe o nome");
    const { error } = await supabase.from("cc_employees" as any).insert({ ...form, user_id: userId, obra_id: obraId });
    if (error) return toast.error(error.message);
    toast.success("Funcionário cadastrado");
    setForm({ nome: "", funcao: "", valor_diaria: 0, valor_mensal: 0, data_entrada: new Date().toISOString().slice(0, 10), status: "ativo" });
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir funcionário?")) return;
    await supabase.from("cc_employees" as any).delete().eq("id", id);
    onChanged();
  };

  const ranking = employees.map((emp: Employee) => {
    const total = entries
      .filter((e: Entry) => e.funcionario_id === emp.id)
      .reduce((s: number, e: Entry) => s + Number(e.valor_total || 0), 0);
    return { name: emp.nome, total };
  }).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        {employees.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">Sem funcionários.</div>
        ) : (
          <ul className="space-y-2">
            {employees.map((emp: Employee) => {
              const gasto = ranking.find((r: any) => r.name === emp.nome)?.total || 0;
              return (
                <li key={emp.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold">{emp.nome[0]}</div>
                  <div className="flex-1">
                    <p className="font-medium">{emp.nome}</p>
                    <p className="text-xs text-muted-foreground">{emp.funcao || "—"} • {emp.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total gasto</p>
                    <p className="font-semibold tabular-nums">{formatBRL(gasto)}</p>
                  </div>
                  <button onClick={() => remove(emp.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ul>
        )}
        {ranking.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Ranking de custo</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={ranking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-4">
        <h3 className="font-semibold mb-3">Novo funcionário</h3>
        <div className="space-y-2.5">
          <input className={inputCls} placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className={inputCls} placeholder="Função" value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" className={inputCls} placeholder="Diária" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: Number(e.target.value) })} />
            <input type="number" step="0.01" className={inputCls} placeholder="Mensal" value={form.valor_mensal} onChange={(e) => setForm({ ...form, valor_mensal: Number(e.target.value) })} />
          </div>
          <input type="date" className={inputCls} value={form.data_entrada} onChange={(e) => setForm({ ...form, data_entrada: e.target.value })} />
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="afastado">Afastado</option>
            <option value="inativo">Inativo</option>
          </select>
          <button onClick={save} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ============== MATERIAIS ============== */
function MateriaisTab({ entries }: any) {
  const [search, setSearch] = useState("");
  const materiais = useMemo(() => {
    const map = new Map<string, { tag: string; total: number; qtd: number; valores: number[]; fornecedores: Record<string, number>; itens: Entry[] }>();
    entries.filter((e: Entry) => e.tipo === "material").forEach((e: Entry) => {
      (e.tags?.length ? e.tags : ["outros"]).forEach((tag) => {
        const m = map.get(tag) || { tag, total: 0, qtd: 0, valores: [], fornecedores: {}, itens: [] };
        m.total += Number(e.valor_total || 0);
        m.qtd += Number(e.quantidade || 0);
        m.valores.push(Number(e.valor_unitario || 0));
        if (e.fornecedor) m.fornecedores[e.fornecedor] = (m.fornecedores[e.fornecedor] || 0) + Number(e.valor_total || 0);
        m.itens.push(e);
        map.set(tag, m);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  const filtered = materiais.filter((m) => !search || m.tag.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tag de material (ex: cimento)..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">Sem materiais lançados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((m) => {
            const media = m.valores.length ? m.valores.reduce((s, v) => s + v, 0) / m.valores.length : 0;
            const topForn = Object.entries(m.fornecedores).sort((a, b) => b[1] - a[1])[0]?.[0];
            return (
              <div key={m.tag} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold capitalize">#{m.tag}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Total gasto</p><p className="font-semibold tabular-nums">{formatBRL(m.total)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold tabular-nums">{m.qtd.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Preço médio</p><p className="font-semibold tabular-nums">{formatBRL(media)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Top fornecedor</p><p className="font-medium truncate">{topForn || "—"}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============== ANALYTICS ============== */
function AnalyticsTab({ entries, orcamentoPrevisto, gastoTotal, pctConsumido, saude }: any) {
  const insights = useMemo(() => {
    if (entries.length === 0) return [];
    const materiais = entries.filter((e: Entry) => e.tipo === "material");
    const maisCaro = [...entries].sort((a, b) => Number(b.valor_total) - Number(a.valor_total))[0];
    const porCat: Record<string, number> = {};
    entries.forEach((e: Entry) => { porCat[e.tipo] = (porCat[e.tipo] || 0) + Number(e.valor_total); });
    const critica = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
    const meses = new Set(entries.map((e: Entry) => e.data?.slice(0, 7))).size || 1;
    const media = gastoTotal / meses;
    const previsao = gastoTotal + media * 3;
    const estouro = orcamentoPrevisto > 0 && previsao > orcamentoPrevisto;
    return [
      { tone: "rose", label: "Item mais caro", value: `${maisCaro?.nome_item} — ${formatBRL(maisCaro?.valor_total || 0)}` },
      { tone: "amber", label: "Categoria crítica", value: `${critica?.[0]} — ${formatBRL(critica?.[1] || 0)}` },
      { tone: estouro ? "rose" : "emerald", label: "Previsão final estimada", value: `${formatBRL(previsao)} ${estouro ? "(risco de estouro)" : "(dentro do orçamento)"}` },
      { tone: "indigo", label: "Média mensal de gasto", value: formatBRL(media) },
      { tone: "blue", label: "Materiais lançados", value: `${materiais.length} itens` },
    ];
  }, [entries, gastoTotal, orcamentoPrevisto]);

  const score = Math.max(0, Math.min(100, Math.round(100 - pctConsumido)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((i, idx) => (
          <div key={idx} className={`rounded-2xl border border-border bg-card p-5 relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30 bg-${i.tone}-500`} />
            <p className="text-xs text-muted-foreground relative">{i.label}</p>
            <p className="text-base font-semibold mt-1 relative">{i.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-1">Saúde Financeira</h3>
        <p className="text-xs text-muted-foreground mb-4">Score automático</p>
        <div className="relative w-full aspect-square max-w-[220px] mx-auto">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
            <circle
              cx="60" cy="60" r="50" fill="none" strokeWidth="12" strokeLinecap="round"
              stroke={saude === "saudavel" ? "#10b981" : saude === "atencao" ? "#f59e0b" : "#ef4444"}
              strokeDasharray={`${(score / 100) * 314} 314`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold tabular-nums">{score}</p>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </div>
        <p className={`text-center mt-3 text-sm font-medium ${saude === "saudavel" ? "text-emerald-600" : saude === "atencao" ? "text-amber-600" : "text-rose-600"}`}>
          {saude === "saudavel" ? "🟢 Obra saudável" : saude === "atencao" ? "🟡 Atenção" : "🔴 Risco financeiro"}
        </p>
      </div>
    </div>
  );
}

/* ============== RELATÓRIOS ============== */
function RelatoriosTab({ entries, obra, orcamentoPrevisto, gastoTotal }: any) {
  const exportCSV = () => {
    const headers = ["Data", "Tipo", "Item", "Categoria", "Qtd", "Unidade", "Vl. Unit.", "Total", "Fornecedor", "Pagamento"];
    const rows = entries.map((e: Entry) => [
      e.data, e.tipo, e.nome_item, e.categoria || "", e.quantidade, e.unidade,
      e.valor_unitario, e.valor_total, e.fornecedor || "", e.forma_pagamento || "",
    ]);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `central-custos-${obra?.name || "obra"}.csv`;
    a.click();
  };

  const reports = [
    { title: "Resumo Financeiro", desc: "Visão consolidada de orçamento, gasto e saldo" },
    { title: "Custos por Categoria", desc: "Distribuição de gastos por tipo" },
    { title: "Materiais", desc: "Consumo agrupado por tag" },
    { title: "Funcionários", desc: "Folha e custos de mão de obra" },
    { title: "Evolução Financeira", desc: "Linha do tempo mensal" },
    { title: "Previsto x Realizado", desc: "Comparativo orçado vs executado" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Exportar dados</h3>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Download className="h-4 w-4" /> CSV completo
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {entries.length} lançamentos • Total {formatBRL(gastoTotal)} de {formatBRL(orcamentoPrevisto)}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => (
          <button
            key={r.title}
            onClick={() => toast.info("Geração de PDF premium em breve. Use o CSV por enquanto.")}
            className="text-left bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow group"
          >
            <div className="inline-flex p-2 rounded-xl bg-primary/10 text-primary mb-3">
              <FileText className="h-4 w-4" />
            </div>
            <h4 className="font-semibold group-hover:text-primary transition-colors">{r.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============== ARQUIVOS ============== */
function ArquivosTab({ obraId, userId }: any) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: ["cc-files", obraId],
    queryFn: async () => {
      const { data } = await supabase.from("cc_attachments" as any).select("*").eq("obra_id", obraId).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const upload = async (file: File) => {
    const path = `${userId}/${obraId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cc-comprovantes").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("cc_attachments" as any).insert({
      user_id: userId, obra_id: obraId, file_name: file.name, file_path: path, file_size: file.size, content_type: file.type,
    });
    toast.success("Arquivo enviado");
    qc.invalidateQueries({ queryKey: ["cc-files", obraId] });
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-card"}`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Arraste arquivos ou clique para enviar</p>
        <p className="text-xs text-muted-foreground">PDF, imagens, planilhas...</p>
        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </label>
      {files.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6">Nenhum arquivo.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {files.map((f) => (
            <li key={f.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============== CONFIG ============== */
function ConfigTab({ obraId, userId, settings, onSaved }: any) {
  const [form, setForm] = useState<Settings>({
    orcamento_previsto: settings?.orcamento_previsto || 0,
    meta_margem: settings?.meta_margem || 0,
    alerta_estouro_pct: settings?.alerta_estouro_pct || 90,
    obra_publica: settings?.obra_publica || false,
    imagem_url: settings?.imagem_url || null,
  });
  useEffect(() => {
    if (settings) setForm({
      orcamento_previsto: settings.orcamento_previsto || 0,
      meta_margem: settings.meta_margem || 0,
      alerta_estouro_pct: settings.alerta_estouro_pct || 90,
      obra_publica: settings.obra_publica || false,
      imagem_url: settings.imagem_url || null,
    });
  }, [settings]);
  const save = async () => {
    const payload = { ...form, user_id: userId, obra_id: obraId };
    const { error } = await supabase.from("cc_obra_settings" as any).upsert(payload, { onConflict: "obra_id" });
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    onSaved();
  };
  const inputCls = "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm";
  return (
    <div className="max-w-2xl bg-card border border-border rounded-2xl p-6 space-y-4">
      <h3 className="font-semibold">Configurações financeiras</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Orçamento previsto</label>
          <input type="number" step="0.01" className={inputCls} value={form.orcamento_previsto} onChange={(e) => setForm({ ...form, orcamento_previsto: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Meta de margem (%)</label>
          <input type="number" step="0.1" className={inputCls} value={form.meta_margem} onChange={(e) => setForm({ ...form, meta_margem: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Alerta de estouro (%)</label>
          <input type="number" className={inputCls} value={form.alerta_estouro_pct} onChange={(e) => setForm({ ...form, alerta_estouro_pct: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select className={inputCls} value={form.obra_publica ? "publica" : "privada"} onChange={(e) => setForm({ ...form, obra_publica: e.target.value === "publica" })}>
            <option value="privada">Privada</option>
            <option value="publica">Pública</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">URL da imagem (capa)</label>
          <input className={inputCls} value={form.imagem_url || ""} onChange={(e) => setForm({ ...form, imagem_url: e.target.value })} placeholder="https://..." />
        </div>
      </div>
      <button onClick={save} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">Salvar</button>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
