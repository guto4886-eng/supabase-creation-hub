import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  LineChart as LineIcon, FileBarChart, FolderOpen, Settings as SettingsIcon, Sparkles, Info,
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
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

        <OrcamentoInlineEditor
          obraId={obraId}
          userId={user?.id || ""}
          value={orcamentoPrevisto}
          onSaved={refresh}
        />
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
            <RelatoriosTab entries={entries} obra={obra} orcamentoPrevisto={orcamentoPrevisto} gastoTotal={gastoTotal} phases={allPhases} employees={employees} />
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
    { icon: Target, label: "Orçamento Previsto", value: orcamentoPrevisto, color: "from-indigo-500/15 to-transparent", ico: "text-indigo-500",
      tip: "Valor definido manualmente na aba Configurações como meta orçamentária da obra." },
    { icon: Wallet, label: "Gasto Total", value: gastoTotal, color: "from-rose-500/15 to-transparent", ico: "text-rose-500",
      tip: "Soma de todos os lançamentos de custo registrados nesta obra (campo valor_total)." },
    { icon: TrendingUp, label: "Saldo Disponível", value: saldo, color: "from-emerald-500/15 to-transparent", ico: "text-emerald-500",
      tip: "Orçamento Previsto − Gasto Total. Valor que ainda resta da meta definida." },
    { icon: AlertTriangle, label: "Previsão Final", value: previsaoFinal, color: "from-amber-500/15 to-transparent", ico: "text-amber-500",
      tip: "Projeção estimada do custo final da obra.\n\nFórmula:\n• meses = nº de meses distintos com lançamentos\n• média mensal = Gasto Total ÷ meses\n• Previsão Final = Gasto Total + (média mensal × 3)\n\nOu seja: pega o ritmo médio de gasto e projeta mais 3 meses à frente." },
    { icon: Activity, label: "Margem", value: margem, fmt: "pct", color: "from-blue-500/15 to-transparent", ico: "text-blue-500",
      tip: "(Saldo ÷ Orçamento Previsto) × 100. Percentual do orçamento ainda disponível." },
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
              <div className="flex items-start justify-between">
                <div className={`inline-flex p-2 rounded-xl bg-background/60 ${k.ico}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                {k.tip && (
                  <span
                    title={k.tip}
                    className="cursor-help text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Como é calculado: ${k.label}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                )}
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
        <QuickAddCost obraId={obraId} userId={userId} employees={employees} onSaved={onSaved} phases={phases} />
      </div>
    </div>
  );
}

/* ============== QUICK ADD ============== */
function QuickAddCost({ obraId, userId, employees, onSaved, editing, onCancelEdit, phases = DEFAULT_PHASES }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tipo: "material", fase: "", nome_item: "", categoria: "", quantidade: 1, unidade: "un",
    valor_unitario: 0, data: new Date().toISOString().slice(0, 10),
    forma_pagamento: "", fornecedor: "", funcionario_id: "", observacao: "",
  });
  const [phaseSearch, setPhaseSearch] = useState("");
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        tipo: editing.tipo, fase: editing.fase || "", nome_item: editing.nome_item, categoria: editing.categoria || "",
        quantidade: editing.quantidade, unidade: editing.unidade,
        valor_unitario: editing.valor_unitario, data: editing.data,
        forma_pagamento: editing.forma_pagamento || "", fornecedor: editing.fornecedor || "",
        funcionario_id: editing.funcionario_id || "", observacao: editing.observacao || "",
      });
    }
  }, [editing]);

  const valorTotal = Number(form.quantidade || 0) * Number(form.valor_unitario || 0);

  const filteredPhases = useMemo(() => {
    const q = phaseSearch.toLowerCase().trim();
    return (phases as Phase[]).filter((p) => !q || p.nome.toLowerCase().includes(q));
  }, [phases, phaseSearch]);

  const createPhase = async (name: string) => {
    const nome = name.trim();
    if (!nome) return;
    const { error } = await supabase.from("cc_phases" as any).insert({ user_id: userId, nome });
    if (error) {
      if (error.code !== "23505") return toast.error(error.message);
    }
    toast.success(`Fase "${nome}" adicionada`);
    setForm({ ...form, fase: nome });
    setPhaseSearch("");
    setNewPhaseName("");
    setPhaseOpen(false);
    qc.invalidateQueries({ queryKey: ["cc-phases"] });
  };

  const save = async () => {
    if (!form.nome_item) { toast.error("Informe o nome do item"); return; }
    if (!form.fase) { toast.error("Selecione a fase da obra"); return; }
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
        tipo: form.tipo, fase: form.fase, nome_item: form.nome_item,
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

        {/* Seletor de Fase (pesquisável + criar nova) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPhaseOpen((v) => !v)}
            className={`${inputCls} flex items-center justify-between text-left`}
          >
            {form.fase ? (
              <span className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: phaseColor(form.fase, phases) }} />
                <span>{phaseIcon(form.fase, phases)}</span>
                <span className="truncate">{form.fase}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Fase da obra *</span>
            )}
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {phaseOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPhaseOpen(false)} />
              <div className="absolute z-40 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <input
                    autoFocus
                    value={phaseSearch}
                    onChange={(e) => setPhaseSearch(e.target.value)}
                    placeholder="Buscar fase..."
                    className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm outline-none"
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto">
                  {filteredPhases.map((p) => (
                    <li key={p.nome}>
                      <button
                        type="button"
                        onClick={() => { setForm({ ...form, fase: p.nome }); setPhaseOpen(false); setPhaseSearch(""); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />
                        <span>{p.icone}</span>
                        <span>{p.nome}</span>
                      </button>
                    </li>
                  ))}
                  {filteredPhases.length === 0 && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">Nenhuma fase encontrada</li>
                  )}
                </ul>
                <div className="p-2 border-t border-border flex gap-2">
                  <input
                    value={newPhaseName}
                    onChange={(e) => setNewPhaseName(e.target.value)}
                    placeholder="Nova fase..."
                    className="flex-1 h-9 px-2 rounded-lg border border-border bg-background text-sm outline-none"
                    onKeyDown={(e) => e.key === "Enter" && createPhase(newPhaseName)}
                  />
                  <button
                    type="button"
                    onClick={() => createPhase(newPhaseName || phaseSearch)}
                    className="px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Nova Fase
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

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
function CustosTab({ entries, obraId, userId, onChanged, phases = DEFAULT_PHASES }: any) {
  const [search, setSearch] = useState("");
  const [tipoF, setTipoF] = useState("todos");
  const [faseF, setFaseF] = useState("todas");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [details, setDetails] = useState<Entry | null>(null);

  const usedPhases = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e: Entry) => e.fase && s.add(e.fase));
    return Array.from(s).sort();
  }, [entries]);

  const filtered = entries.filter((e: Entry) => {
    if (search && !`${e.nome_item} ${e.fornecedor || ""} ${e.categoria || ""} ${e.fase || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (tipoF !== "todos" && e.tipo !== tipoF) return false;
    if (faseF !== "todas" && e.fase !== faseF) return false;
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
        <div className="bg-card border border-border rounded-2xl p-3 flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar custo..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm" />
          </div>
          <select value={tipoF} onChange={(e) => setTipoF(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-background text-sm">
            <option value="todos">Todos tipos</option>
            {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={faseF} onChange={(e) => setFaseF(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-background text-sm">
            <option value="todas">Todas as fases</option>
            {usedPhases.map((f) => <option key={f} value={f}>{f}</option>)}
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
              const cor = phaseColor(e.fase, phases);
              return (
                <li key={e.id} onClick={() => setDetails(e)} className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/40 transition-all flex items-center gap-3 relative overflow-hidden cursor-pointer">
                  <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cor }} />
                  <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-xl">{type?.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{e.nome_item}</p>
                      {e.fase && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold inline-flex items-center gap-1"
                          style={{ background: `${cor}20`, color: cor }}>
                          {phaseIcon(e.fase, phases)} {e.fase}
                        </span>
                      )}
                      {e.tags?.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">#{t}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {type?.label} • {new Date(e.data).toLocaleDateString("pt-BR")}
                      {e.quantidade ? ` • ${e.quantidade} ${e.unidade || ""}` : ""}
                      {e.fornecedor && ` • ${e.fornecedor}`}
                      {e.forma_pagamento && ` • ${e.forma_pagamento}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatBRL(e.valor_total)}</span>
                  <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <button onClick={() => setDetails(e)} className="p-1.5 rounded-lg hover:bg-muted" title="Ver detalhes"><Info className="h-3.5 w-3.5" /></button>
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
      <QuickAddCost obraId={obraId} userId={userId} employees={[]} onSaved={onChanged} editing={editing} onCancelEdit={() => setEditing(null)} phases={phases} />
      <CostDetailsModal entry={details} phases={phases} onClose={() => setDetails(null)} onChanged={onChanged} onEdit={(e: Entry) => { setDetails(null); setEditing(e); }} onDuplicate={(e: Entry) => { setDetails(null); duplicate(e); }} onDelete={(id: string) => { setDetails(null); remove(id); }} />
    </div>
  );
}

function CostDetailsModal({ entry, phases, onClose, onEdit, onDuplicate, onDelete, onChanged }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [comprovante, setComprovante] = useState<string | null>(entry?.comprovante_url ?? null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setComprovante(entry?.comprovante_url ?? null);
  }, [entry?.id, entry?.comprovante_url]);

  useEffect(() => {
    if (!entry) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Foco inicial em um botão de ação seguro
    closeBtnRef.current?.focus();

    const getFocusable = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const nodes = containerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea'
      );
      return Array.from(nodes as NodeListOf<HTMLElement>).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusables = getFocusable();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [entry, onClose]);

  if (!entry) return null;
  const type = COST_TYPES.find((t) => t.value === entry.tipo);
  const cor = phaseColor(entry.fase, phases);
  const Row = ({ label, value }: any) => (
    <div className="flex justify-between gap-4 py-2 border-b border-border/60 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value ?? "—"}</span>
    </div>
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entry) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${entry.user_id}/${entry.obra_id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("cc-comprovantes").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("cc_cost_entries" as any)
        .update({ comprovante_url: path })
        .eq("id", entry.id);
      if (dbErr) throw dbErr;
      // Apaga arquivo anterior, se houver
      if (comprovante && comprovante !== path) {
        await supabase.storage.from("cc-comprovantes").remove([comprovante]);
      }
      setComprovante(path);
      toast.success("Comprovante atualizado");
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Falha ao enviar comprovante");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!entry || !comprovante) return;
    if (!confirm("Remover o comprovante deste lançamento?")) return;
    setUploading(true);
    try {
      await supabase.storage.from("cc-comprovantes").remove([comprovante]);
      const { error } = await supabase
        .from("cc_cost_entries" as any)
        .update({ comprovante_url: null })
        .eq("id", entry.id);
      if (error) throw error;
      setComprovante(null);
      toast.success("Comprovante removido");
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Falha ao remover");
    } finally {
      setUploading(false);
    }
  };

  const openComprovante = async () => {
    if (!comprovante) return;
    const { data, error } = await supabase.storage
      .from("cc-comprovantes")
      .createSignedUrl(comprovante, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center text-xl" aria-hidden="true">{type?.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="font-semibold truncate">{entry.nome_item}</h3>
            <p className="text-xs opacity-80">{type?.label} • {new Date(entry.data).toLocaleDateString("pt-BR")}</p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fechar detalhes do lançamento"
            className="px-2 py-1 rounded-lg hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-1">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground uppercase">Valor Total</p>
              <p className="text-xl font-bold tabular-nums">{formatBRL(entry.valor_total)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground uppercase">Qtd × Unitário</p>
              <p className="text-xl font-bold tabular-nums">{entry.quantidade} {entry.unidade || ""} <span className="text-sm font-normal text-muted-foreground">× {formatBRL(entry.valor_unitario)}</span></p>
            </div>
          </div>
          <Row label="Tipo" value={type?.label} />
          <Row label="Categoria" value={entry.categoria} />
          <Row label="Fase" value={entry.fase ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: `${cor}20`, color: cor }}>{phaseIcon(entry.fase, phases)} {entry.fase}</span> : null} />
          <Row label="Quantidade" value={`${entry.quantidade} ${entry.unidade || ""}`} />
          <Row label="Valor Unitário" value={formatBRL(entry.valor_unitario)} />
          <Row label="Valor Total" value={formatBRL(entry.valor_total)} />
          <Row label="Data" value={new Date(entry.data).toLocaleDateString("pt-BR")} />
          <Row label="Forma de Pagamento" value={entry.forma_pagamento} />
          <Row label="Fornecedor" value={entry.fornecedor} />
          <Row label="Tags" value={entry.tags?.length ? <div className="flex flex-wrap gap-1 justify-end">{entry.tags.map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">#{t}</span>)}</div> : null} />
          <Row label="Observação" value={entry.observacao} />
          {entry.comprovante_url && (
            <Row label="Comprovante" value={<a href={entry.comprovante_url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir arquivo</a>} />
          )}
          <Row label="Cadastrado em" value={entry.created_at ? new Date(entry.created_at).toLocaleString("pt-BR") : null} />
        </div>
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button onClick={() => onDelete(entry.id)} className="h-9 px-3 rounded-lg text-sm bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-500/50 inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir</button>
          <button onClick={() => onDuplicate(entry)} className="h-9 px-3 rounded-lg text-sm bg-muted hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary/50 inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Duplicar</button>
          <button onClick={() => onEdit(entry)} className="h-9 px-3 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/70 inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar</button>
        </div>
      </div>
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
  const [groupMode, setGroupMode] = useState<"item" | "tag">("item");

  const materiais = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tags: string[]; total: number; qtd: number; valores: number[]; fornecedores: Record<string, number>; itens: Entry[] }>();
    entries.filter((e: Entry) => e.tipo === "material").forEach((e: Entry) => {
      if (groupMode === "item") {
        const key = (e.nome_item || "—").trim().toUpperCase();
        const m = map.get(key) || { key, label: key, tags: e.tags || [], total: 0, qtd: 0, valores: [], fornecedores: {}, itens: [] };
        m.total += Number(e.valor_total || 0);
        m.qtd += Number(e.quantidade || 0);
        m.valores.push(Number(e.valor_unitario || 0));
        if (e.fornecedor) m.fornecedores[e.fornecedor] = (m.fornecedores[e.fornecedor] || 0) + Number(e.valor_total || 0);
        m.itens.push(e);
        map.set(key, m);
      } else {
        (e.tags?.length ? e.tags : ["outros"]).forEach((tag) => {
          const m = map.get(tag) || { key: tag, label: tag, tags: [tag], total: 0, qtd: 0, valores: [], fornecedores: {}, itens: [] };
          m.total += Number(e.valor_total || 0);
          m.qtd += Number(e.quantidade || 0);
          m.valores.push(Number(e.valor_unitario || 0));
          if (e.fornecedor) m.fornecedores[e.fornecedor] = (m.fornecedores[e.fornecedor] || 0) + Number(e.valor_total || 0);
          m.itens.push(e);
          map.set(tag, m);
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries, groupMode]);

  const filtered = materiais.filter((m) =>
    !search ||
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-3 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar material ou tag..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm" />
        </div>
        <div className="inline-flex rounded-xl border border-border overflow-hidden text-xs">
          <button onClick={() => setGroupMode("item")} className={`px-3 h-10 ${groupMode === "item" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Por item</button>
          <button onClick={() => setGroupMode("tag")} className={`px-3 h-10 ${groupMode === "tag" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Por tag</button>
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
              <div key={m.key} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-semibold truncate" title={m.label}>{groupMode === "tag" ? `#${m.label}` : m.label}</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{m.itens.length} lanç.</span>
                </div>
                {groupMode === "item" && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {m.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">#{t}</span>
                    ))}
                  </div>
                )}
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
function AnalyticsTab({ entries, orcamentoPrevisto, gastoTotal, pctConsumido, saude, phases = DEFAULT_PHASES }: any) {
  // Dados por fase
  const porFase = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: Entry) => {
      const k = e.fase || "Sem fase";
      map[k] = (map[k] || 0) + Number(e.valor_total || 0);
    });
    return Object.entries(map)
      .map(([nome, total]) => ({ nome, total, cor: phaseColor(nome === "Sem fase" ? null : nome, phases) }))
      .sort((a, b) => b.total - a.total);
  }, [entries, phases]);

  const totalFases = porFase.reduce((s, p) => s + p.total, 0);

  // Evolução por fase (mensal)
  const evolucaoFase = useMemo(() => {
    const meses = new Set<string>();
    entries.forEach((e: Entry) => meses.add(e.data?.slice(0, 7)));
    const sortedMeses = Array.from(meses).filter(Boolean).sort();
    const topFases = porFase.slice(0, 5).map((p) => p.nome);
    return sortedMeses.map((m) => {
      const row: any = { mes: m.slice(5) + "/" + m.slice(2, 4) };
      topFases.forEach((f) => { row[f] = 0; });
      entries.filter((e: Entry) => e.data?.slice(0, 7) === m).forEach((e: Entry) => {
        const k = e.fase || "Sem fase";
        if (topFases.includes(k)) row[k] = (row[k] || 0) + Number(e.valor_total || 0);
      });
      return row;
    });
  }, [entries, porFase]);

  const topFases = porFase.slice(0, 5);

  // Insights automáticos
  const phaseInsights = useMemo(() => {
    const out: Array<{ tone: "amber" | "rose" | "emerald" | "indigo"; icon: string; text: string }> = [];
    if (entries.length === 0) return out;
    // 1. Fase consumindo orçamento
    if (orcamentoPrevisto > 0 && porFase[0]) {
      const pct = (porFase[0].total / orcamentoPrevisto) * 100;
      if (pct >= 50) out.push({ tone: "amber", icon: "🟡", text: `ALERTA: ${porFase[0].nome} consumiu ${pct.toFixed(0)}% do orçamento previsto.` });
    }
    // 2. Crescimento semanal por fase
    const now = new Date();
    const semanaAtual = entries.filter((e: Entry) => (now.getTime() - new Date(e.data).getTime()) / 86400000 <= 7);
    const semanaAnterior = entries.filter((e: Entry) => {
      const d = (now.getTime() - new Date(e.data).getTime()) / 86400000;
      return d > 7 && d <= 14;
    });
    const sumByFase = (arr: Entry[]) => arr.reduce((m: any, e) => { const k = e.fase || "Sem fase"; m[k] = (m[k] || 0) + Number(e.valor_total); return m; }, {});
    const a = sumByFase(semanaAtual), b = sumByFase(semanaAnterior);
    Object.keys(a).forEach((k) => {
      if (b[k] && a[k] > b[k] * 1.2) {
        out.push({ tone: "rose", icon: "🔴", text: `RISCO: Custos de ${k} cresceram ${(((a[k] - b[k]) / b[k]) * 100).toFixed(0)}% esta semana.` });
      }
    });
    // 3. Fase abaixo do previsto (economia)
    const fasesComBaixoGasto = porFase.filter((p) => p.total > 0 && p.total < totalFases * 0.05);
    fasesComBaixoGasto.slice(0, 1).forEach((p) => {
      out.push({ tone: "emerald", icon: "🟢", text: `ECONOMIA: Fase de ${p.nome} ficou abaixo do previsto.` });
    });
    if (out.length === 0) {
      out.push({ tone: "indigo", icon: "ℹ️", text: "Sem alertas críticos por fase no momento." });
    }
    return out.slice(0, 5);
  }, [entries, porFase, orcamentoPrevisto, totalFases]);

  const score = Math.max(0, Math.min(100, Math.round(100 - pctConsumido)));

  return (
    <div className="space-y-4">
      {/* Insights por fase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {phaseInsights.map((i, idx) => {
          const toneCls = i.tone === "rose" ? "border-rose-500/40 bg-rose-500/5"
            : i.tone === "amber" ? "border-amber-500/40 bg-amber-500/5"
            : i.tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-indigo-500/40 bg-indigo-500/5";
          return (
            <div key={idx} className={`rounded-2xl border ${toneCls} p-4 flex gap-3`}>
              <span className="text-xl">{i.icon}</span>
              <p className="text-sm font-medium">{i.text}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut Gastos por Fase */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Gastos por Fase</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição percentual</p>
          <div className="h-64">
            {porFase.length === 0 ? <EmptyChart label="Sem dados" /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={porFase} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {porFase.map((p, i) => <Cell key={i} fill={p.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1 mt-2 text-xs max-h-40 overflow-y-auto">
            {porFase.slice(0, 8).map((p) => (
              <div key={p.nome} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />
                  {p.nome}
                </span>
                <span className="font-medium tabular-nums">{totalFases > 0 ? ((p.total / totalFases) * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução por etapa */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Evolução Financeira por Etapa</h3>
          <p className="text-xs text-muted-foreground mb-4">Top 5 fases ao longo dos meses</p>
          <div className="h-64">
            {evolucaoFase.length === 0 ? <EmptyChart label="Sem lançamentos" /> : (
              <ResponsiveContainer>
                <LineChart data={evolucaoFase}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  {topFases.map((p) => (
                    <Line key={p.nome} type="monotone" dataKey={p.nome} stroke={p.cor} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Ranking das fases mais caras */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-4">Ranking das Fases Mais Caras</h3>
        {topFases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topFases.map((p, i) => (
              <div key={p.nome} className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: p.cor }} />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md" style={{ background: `${p.cor}20`, color: p.cor }}>#{i + 1}</span>
                  <span className="text-lg">{phaseIcon(p.nome, phases)}</span>
                  <p className="font-semibold truncate">{p.nome}</p>
                </div>
                <p className="text-2xl font-bold tabular-nums mt-2">{formatBRL(p.total)}</p>
                <p className="text-xs text-muted-foreground">{totalFases > 0 ? ((p.total / totalFases) * 100).toFixed(1) : 0}% do total</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-4">Resumo de saúde</h3>
          <p className="text-sm text-muted-foreground">
            Score automático calculado com base no consumo do orçamento.
            Quanto mais próximo de 100, mais saudável a obra.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Saúde Financeira</h3>
          <p className="text-xs text-muted-foreground mb-4">Score automático</p>
          <div className="relative w-full aspect-square max-w-[200px] mx-auto">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
              <circle cx="60" cy="60" r="50" fill="none" strokeWidth="12" strokeLinecap="round"
                stroke={saude === "saudavel" ? "#10b981" : saude === "atencao" ? "#f59e0b" : "#ef4444"}
                strokeDasharray={`${(score / 100) * 314} 314`} />
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
    </div>
  );
}

/* ============== RELATÓRIOS ============== */
function RelatoriosTab({ entries, obra, orcamentoPrevisto, gastoTotal, phases = DEFAULT_PHASES, employees = [] }: any) {
  const porFase = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: Entry) => {
      const k = e.fase || "Sem fase";
      map[k] = (map[k] || 0) + Number(e.valor_total || 0);
    });
    return Object.entries(map)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [entries]);

  // Filtros do relatório
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fFase, setFFase] = useState("");
  const [fFornecedor, setFFornecedor] = useState("");
  const [fPagamento, setFPagamento] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered: Entry[] = useMemo(() => {
    return entries.filter((e: Entry) => {
      if (fInicio && (e.data || "") < fInicio) return false;
      if (fFim && (e.data || "") > fFim) return false;
      if (fTipo && e.tipo !== fTipo) return false;
      if (fFase && (e.fase || "Sem fase") !== fFase) return false;
      if (fFornecedor && !(e.fornecedor || "").toLowerCase().includes(fFornecedor.toLowerCase())) return false;
      if (fPagamento && e.forma_pagamento !== fPagamento) return false;
      return true;
    });
  }, [entries, fInicio, fFim, fTipo, fFase, fFornecedor, fPagamento]);

  const filteredGasto = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor_total || 0), 0), [filtered]);

  const ctx = (): import("@/utils/ccPdfReports").ReportContext => ({
    obraName: obra?.name || "Obra",
    obraInicio: obra?.start_date,
    orcamentoPrevisto,
    gastoTotal: filteredGasto,
    entries: filtered as any,
    employees: employees as any,
    phases,
    periodoLabel: fInicio || fFim
      ? `${fInicio ? new Date(fInicio + "T00:00:00").toLocaleDateString("pt-BR") : "..."} a ${fFim ? new Date(fFim + "T00:00:00").toLocaleDateString("pt-BR") : "..."}`
      : "Todos os lançamentos",
  });

  const exportCSV = () => {
    const headers = ["Data", "Tipo", "Fase", "Item", "Categoria", "Qtd", "Unidade", "Vl. Unit.", "Total", "Fornecedor", "Pagamento"];
    const rows = filtered.map((e: Entry) => [
      e.data, e.tipo, e.fase || "", e.nome_item, e.categoria || "", e.quantidade, e.unidade,
      e.valor_unitario, e.valor_total, e.fornecedor || "", e.forma_pagamento || "",
    ]);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `central-custos-${obra?.name || "obra"}.csv`;
    a.click();
  };

  const generate = async (id: string) => {
    setGenerating(id);
    try {
      const mod = await import("@/utils/ccPdfReports");
      const c = ctx();
      switch (id) {
        case "resumo": await mod.gerarResumoFinanceiro(c); break;
        case "categoria": await mod.gerarCustosPorCategoria(c); break;
        case "fase": await mod.gerarCustosPorFase(c); break;
        case "materiais": await mod.gerarMateriais(c); break;
        case "funcionarios": await mod.gerarFuncionarios(c); break;
        case "evolucao": await mod.gerarEvolucao(c); break;
        case "previsto": await mod.gerarPrevistoRealizado(c); break;
      }
      toast.success("Relatório PDF gerado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PDF");
    } finally {
      setGenerating(null);
    }
  };

  const totalFases = porFase.reduce((s, p) => s + p.total, 0);

  const tiposUnicos = useMemo(() => Array.from(new Set(entries.map((e: Entry) => e.tipo))) as string[], [entries]);
  const pagamentosUnicos = useMemo(() => Array.from(new Set(entries.map((e: Entry) => e.forma_pagamento).filter(Boolean))) as string[], [entries]);
  const fasesUnicas = useMemo(() => Array.from(new Set(entries.map((e: Entry) => e.fase || "Sem fase"))) as string[], [entries]);

  const reports = [
    { id: "resumo", title: "Resumo Financeiro", desc: "Visão consolidada de orçamento, gasto, saldo e saúde" },
    { id: "categoria", title: "Custos por Categoria", desc: "Donut, ranking e detalhamento por tipo" },
    { id: "fase", title: "Custos por Fase da Obra", desc: "Análise completa por etapa com alertas automáticos" },
    { id: "materiais", title: "Materiais", desc: "Consumo agrupado por tag, fornecedores e evolução" },
    { id: "funcionarios", title: "Funcionários", desc: "Folha total, ranking e custos da equipe" },
    { id: "evolucao", title: "Evolução Financeira", desc: "Linha do tempo mensal, acumulado e projeção" },
    { id: "previsto", title: "Previsto x Realizado", desc: "Comparativo por fase com status visual" },
  ];

  const inputCls = "w-full h-9 px-2.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none";

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Filtros do Relatório</h3>
            <p className="text-xs text-muted-foreground">Afetam todos os relatórios e a exportação CSV abaixo</p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} de {entries.length} lançamentos • {formatBRL(filteredGasto)}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Início</label>
            <input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fim</label>
            <input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Categoria</label>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fase</label>
            <select value={fFase} onChange={(e) => setFFase(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {fasesUnicas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fornecedor</label>
            <input value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)} placeholder="Buscar..." className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Pagamento</label>
            <select value={fPagamento} onChange={(e) => setFPagamento(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {pagamentosUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent">
            <FileText className="h-3.5 w-3.5" /> Imprimir tela
          </button>
          <button
            onClick={() => { setFInicio(""); setFFim(""); setFTipo(""); setFFase(""); setFFornecedor(""); setFPagamento(""); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent ml-auto"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Cards de relatórios PDF */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => {
          const isGen = generating === r.id;
          return (
            <button
              key={r.id}
              disabled={!!generating}
              onClick={() => generate(r.id)}
              className="text-left bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-primary/40 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex p-2 rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h4 className="font-semibold group-hover:text-primary transition-colors">{r.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              <p className="text-[11px] text-primary font-medium mt-3">
                {isGen ? "Gerando PDF..." : "Gerar PDF premium →"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Sessão: Custos por Fase da Obra */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Custos por Fase da Obra</h3>
            <p className="text-xs text-muted-foreground">Total, percentual e comparativo</p>
          </div>
          <span className="text-sm font-semibold tabular-nums">{formatBRL(totalFases)}</span>
        </div>
        {porFase.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem lançamentos com fase atribuída.</p>
        ) : (
          <ul className="space-y-2">
            {porFase.map((p) => {
              const cor = phaseColor(p.nome === "Sem fase" ? null : p.nome, phases);
              const pct = totalFases > 0 ? (p.total / totalFases) * 100 : 0;
              return (
                <li key={p.nome} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
                      <span>{phaseIcon(p.nome === "Sem fase" ? null : p.nome, phases)}</span>
                      {p.nome}
                    </span>
                    <span className="tabular-nums font-semibold">{formatBRL(p.total)} <span className="text-xs text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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

function OrcamentoInlineEditor({
  obraId, userId, value, onSaved,
}: { obraId: string; userId: string; value: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState<string>(value ? String(value) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInput(value ? String(value) : "");
  }, [value]);

  const save = async () => {
    if (!userId || !obraId) return;
    const num = input === "" ? null : Number(input);
    if (num != null && (isNaN(num) || num < 0)) return toast.error("Valor inválido");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cc_obra_settings" as any)
        .upsert(
          { obra_id: obraId, user_id: userId, orcamento_previsto: num },
          { onConflict: "obra_id" }
        );
      if (error) throw error;
      toast.success("Orçamento atualizado");
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = !value || value <= 0;

  return (
    <div
      className={`rounded-2xl border p-3 min-w-[260px] ${
        isEmpty
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Orçamento Previsto
          </span>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" /> {isEmpty ? "Definir" : "Editar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            placeholder="0,00"
            className="flex-1 h-9 px-2 rounded-lg border border-border bg-background text-sm tabular-nums focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "..." : "Salvar"}
          </button>
          <button
            onClick={() => { setEditing(false); setInput(value ? String(value) : ""); }}
            className="h-9 px-2 rounded-lg text-xs text-muted-foreground hover:bg-accent"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <p className={`text-xl font-bold tabular-nums ${isEmpty ? "text-amber-700 dark:text-amber-400" : ""}`}>
          {isEmpty ? "Não definido" : formatBRL(value)}
        </p>
      )}
      {isEmpty && !editing && (
        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
          Defina para habilitar saldo, margem e alertas.
        </p>
      )}
    </div>
  );
}

