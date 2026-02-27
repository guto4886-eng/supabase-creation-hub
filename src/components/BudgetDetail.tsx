import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Plus, Pencil, Trash2, FileText, ChevronDown, Settings, Upload, ClipboardList, Download } from "lucide-react";
import BudgetImportModal from "./BudgetImportModal";
import { fetchCompanyInfo, type CompanyInfo } from "@/utils/exportWithHeader";
import { generateBudgetReport } from "@/utils/budgetReports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BudgetDetailProps {
  budgetId: string;
  onClose: () => void;
}

interface BudgetItem {
  id: string;
  budget_id: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  sort_order: number | null;
}

const TABS = [
  { key: "dados", label: "Dados" },
  { key: "valores_custo", label: "Valores custo" },
  { key: "valores_venda", label: "Valores venda" },
  { key: "insumos", label: "Insumos" },
  { key: "curva_abc", label: "Curva ABC" },
  { key: "cronograma", label: "Cronograma" },
  { key: "planejamento", label: "Plan. Físico/Econômico" },
  { key: "medicao", label: "Medição física" },
  { key: "previsto_realizado", label: "Previsto x Realizado" },
];

const statusOptions = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const RELATORIOS = [
  "Orçamento de custo",
  "Orçamento de venda",
  "Relatórios de planejamento",
  "Previsto x Realizado - Custo",
  "Previsto x Realizado de Insumos",
  "Curva ABC",
  "Formulário de orçamento",
  "Prestação de serviço",
  "Proposta comercial",
  "Histograma de recursos",
];

const ACOES = [
  "Novo orçamento",
  "Importar orçamento",
  "Gerar versão do orçamento",
  "Tabelas de custo",
  "Ajustar valores de custo",
];

function DropdownButton({ label, icon: Icon, items, onSelect }: { label: string; icon: any; items: string[]; onSelect: (item: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm font-medium"
      >
        <Icon className="h-4 w-4" />
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-64 bg-card border border-border rounded-lg shadow-lg z-[70] py-1 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => { onSelect(item); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetDetail({ budgetId, onClose }: BudgetDetailProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados");
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });
  const [showImport, setShowImport] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [expandedAbc, setExpandedAbc] = useState<string | null>(null);
  const [activeMeasurement, setActiveMeasurement] = useState<string | null>(null);
  const [planSelectedPhase, setPlanSelectedPhase] = useState<string | null>(null);

  // Fetch plan periods
  const { data: planPeriods = [] } = useQuery({
    queryKey: ["budget_plan_periods", budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_plan_periods" as any)
        .select("*")
        .eq("budget_id", budgetId)
        .order("period_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const planPeriodIds = planPeriods.map((p: any) => p.id);
  const { data: planItems = [] } = useQuery({
    queryKey: ["budget_plan_items", budgetId, planPeriodIds.join(",")],
    enabled: planPeriodIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_plan_items" as any)
        .select("*")
        .in("plan_period_id", planPeriodIds);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch measurements for medicao tab
  const { data: measurements = [] } = useQuery({
    queryKey: ["budget_measurements", budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_measurements")
        .select("*")
        .eq("budget_id", budgetId)
        .order("measurement_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: measurementItems = [] } = useQuery({
    queryKey: ["budget_measurement_items", activeMeasurement],
    enabled: !!activeMeasurement,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_measurement_items")
        .select("*")
        .eq("measurement_id", activeMeasurement!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL measurement items across all measurements for accumulated calculation
  const allMeasurementIds = measurements.map((m: any) => m.id);
  const { data: allMeasurementItems = [] } = useQuery({
    queryKey: ["all_budget_measurement_items", budgetId, allMeasurementIds.join(",")],
    enabled: allMeasurementIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_measurement_items")
        .select("*")
        .in("measurement_id", allMeasurementIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ["budget_detail", budgetId],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").eq("id", budgetId).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ["budget_items", budgetId],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_items").select("*").eq("budget_id", budgetId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data as BudgetItem[];
    },
  });

  // Fetch obra
  const { data: obra } = useQuery({
    queryKey: ["budget_obra", budget?.obra_id],
    enabled: !!budget?.obra_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name, client_id, start_date, expected_end_date").eq("id", budget!.obra_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch distinct phases from obra_daily_entries for this obra
  const { data: obraPhases = [] } = useQuery({
    queryKey: ["obra_phases", budget?.obra_id],
    enabled: !!budget?.obra_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_daily_entries")
        .select("phase")
        .eq("obra_id", budget!.obra_id!)
        .not("phase", "is", null)
        .order("phase");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.phase).filter((p: string) => p && p.trim() !== ""))];
      return unique as string[];
    },
  });

  // Fetch distinct services from obra_daily_entries filtered by selected phase
  const [selectedItemPhase, setSelectedItemPhase] = useState<string>("");
  const { data: obraServices = [] } = useQuery({
    queryKey: ["obra_services", budget?.obra_id, selectedItemPhase],
    enabled: !!budget?.obra_id,
    queryFn: async () => {
      let query = supabase
        .from("obra_daily_entries")
        .select("service")
        .eq("obra_id", budget!.obra_id!)
        .not("service", "is", null);
      if (selectedItemPhase) {
        query = query.eq("phase", selectedItemPhase);
      }
      const { data, error } = await query.order("service");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.service).filter((s: string) => s && s.trim() !== ""))];
      return unique as string[];
    },
  });

  // Fetch client
  const { data: client } = useQuery({
    queryKey: ["budget_client", obra?.client_id],
    enabled: !!obra?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("id", obra!.client_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch company
  const { data: company } = useQuery({
    queryKey: ["budget_company", budget?.company_id],
    enabled: !!budget?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").eq("id", budget!.company_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Budget form state
  const [budgetForm, setBudgetForm] = useState<Record<string, any> | null>(null);

  // Initialize form when budget loads
  if (budget && !budgetForm) {
    setBudgetForm({
      name: budget.name,
      status: budget.status,
      description: budget.description || "",
    });
  }

  // Save budget
  const saveBudget = useMutation({
    mutationFn: async () => {
      if (!budgetForm) return;
      const { error } = await supabase.from("budgets").update({
        name: budgetForm.name,
        status: budgetForm.status,
        description: budgetForm.description || null,
      }).eq("id", budgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_detail", budgetId] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento salvo!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Save item
  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        description: itemForm.description,
        category: itemForm.category || null,
        quantity: parseFloat(itemForm.quantity) || 1,
        unit: itemForm.unit || "un",
        unit_price: parseFloat(itemForm.unit_price) || 0,
      };
      if (editingItem) {
        const { error } = await supabase.from("budget_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_items").insert({ ...payload, budget_id: budgetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success(editingItem ? "Item atualizado!" : "Item adicionado!");
      closeItemForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Item removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAddItem = () => {
    setEditingItem(null);
    setAddingItem(true);
    setSelectedItemPhase("");
    setItemForm({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });
  };
  const openEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setAddingItem(true);
    setSelectedItemPhase(item.category || "");
    setItemForm({ description: item.description, category: item.category || "", quantity: String(item.quantity ?? 1), unit: item.unit || "un", unit_price: String(item.unit_price ?? 0) });
  };
  const closeItemForm = () => { setEditingItem(null); setAddingItem(false); };

  const fmt = (v: number | null | undefined) => (v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00");
  const totalCusto = items.reduce((s, i) => s + (i.total_price || 0), 0);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const periodoObra = obra?.start_date && obra?.expected_end_date
    ? `${formatDate(obra.start_date)} a ${formatDate(obra.expected_end_date)}`
    : obra?.start_date ? `Início: ${formatDate(obra.start_date)}` : "—";

  if (budgetLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!budget) return null;

  const statusColor: Record<string, string> = {
    rascunho: "text-muted-foreground",
    aprovado: "text-green-600",
    rejeitado: "text-destructive",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full flex flex-col"
        style={{ maxWidth: "95vw", maxHeight: "90vh", width: "1400px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
          <h2 className="text-lg font-bold text-primary">
            Orçamento {budget.budget_code || "—"} — {client?.name || "—"} — Obra: {obra?.name || "—"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border bg-muted/30">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "dados" && (
            <div className="space-y-6">
              {/* Info header */}
              <div className="bg-muted/30 rounded-lg border border-border p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Orçamento: </span>
                    <span className="font-semibold text-foreground">{budget.budget_code || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo: </span>
                    <span className="font-medium text-foreground">Orçamento</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Criação: </span>
                    <span className="text-foreground">{new Date(budget.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg border border-border p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cliente: </span>
                    <span className="font-semibold text-foreground">{client?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Obra: </span>
                    <span className="font-semibold text-primary">{obra?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Período obra: </span>
                    <span className="text-foreground">{periodoObra}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg border border-border p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valor custo: </span>
                    <span className="font-semibold text-foreground">{fmt(totalCusto)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor venda + taxas: </span>
                    <span className="font-semibold text-foreground">{fmt(totalCusto)}</span>
                  </div>
                </div>
              </div>

              {/* Budget name and description form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Nome do orçamento *</label>
                    <input
                      value={budgetForm?.name || ""}
                      onChange={(e) => setBudgetForm((p) => p ? { ...p, name: e.target.value } : p)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select
                      value={budgetForm?.status || "rascunho"}
                      onChange={(e) => setBudgetForm((p) => p ? { ...p, status: e.target.value } : p)}
                      className={inputClass}
                    >
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                  <textarea
                    value={budgetForm?.description || ""}
                    onChange={(e) => setBudgetForm((p) => p ? { ...p, description: e.target.value } : p)}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Histórico de versões */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Histórico de versões</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Revisão</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custo (R$)</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Venda + Taxas (R$)</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Criação</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Última modificação</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">1</td>
                        <td className="px-3 py-2 text-foreground">Atual</td>
                        <td className="px-3 py-2 text-right text-foreground">{totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-foreground">{totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(budget.created_at).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(budget.updated_at).toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-muted-foreground">{budget.description || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "valores_custo" && (() => {
            // Phase items have category "Fase"/"fase", services have "Serviço"
            const phaseItems = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItems = items.filter((i) => (i.category || "").toLowerCase() === "serviço" || (i.category || "").toLowerCase() === "servico");

            const getDescPrefix = (desc: string) => {
              const match = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return match ? match[1] : null;
            };

            // Build phase rows from "Fase" items
            const phaseRows = phaseItems
              .map((p) => {
                const prefix = getDescPrefix(p.description);
                const rootIndex = prefix ? prefix.split(".")[0] : null;
                if (!rootIndex || prefix !== rootIndex) return null; // only root-level phases (1, 2, 3...)

                const total = serviceItems
                  .filter((s) => {
                    const sPrefix = getDescPrefix(s.description);
                    return sPrefix ? sPrefix.split(".")[0] === rootIndex : false;
                  })
                  .reduce((sum, s) => sum + (s.total_price || 0), 0);

                return { rootIndex, label: p.description, total };
              })
              .filter((v): v is { rootIndex: string; label: string; total: number } => !!v)
              // Deduplicate by rootIndex
              .filter((v, i, arr) => arr.findIndex((a) => a.rootIndex === v.rootIndex) === i)
              .sort((a, b) => Number.parseInt(a.rootIndex, 10) - Number.parseInt(b.rootIndex, 10));

            // Fallback: if no "Fase" items, use unique categories
            const fallbackRows = phaseRows.length === 0
              ? [...new Set(items.map((i) => (i.category || "Geral").trim()))].map((cat) => ({
                  rootIndex: cat,
                  label: cat,
                  total: items.filter((i) => (i.category || "Geral").trim() === cat).reduce((sum, i) => sum + (i.total_price || 0), 0),
                }))
              : [];

            const rows = phaseRows.length > 0 ? phaseRows : fallbackRows;

            const activePhaseRow = selectedPhase
              ? rows.find((r) => r.label === selectedPhase)
              : null;

            const activePhaseLabel = activePhaseRow?.label ?? null;

            const displayItems = activePhaseRow
              ? serviceItems.filter((s) => {
                  const sPrefix = getDescPrefix(s.description);
                  return sPrefix ? sPrefix.split(".")[0] === activePhaseRow.rootIndex : false;
                })
              : serviceItems.length > 0 ? serviceItems : items;

            return (
              <div className="flex gap-0 h-full">
                {/* Phase sidebar - flat table like reference image */}
                <div className="w-80 flex-shrink-0 border border-border rounded-l-lg overflow-hidden flex flex-col">
                  <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground">Fase da obra</span>
                    <span className="text-xs font-semibold text-muted-foreground">Total (R$)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">
                              Nenhuma fase encontrada.
                            </td>
                          </tr>
                        ) : (
                          rows.map((phase, idx) => {
                            const isActive = activePhaseRow?.label === phase.label;
                            return (
                              <tr
                                key={phase.rootIndex}
                                onClick={() => setSelectedPhase(phase.label)}
                                className={`cursor-pointer border-b border-border transition-colors ${
                                  isActive ? "bg-primary/10 font-bold text-primary" : idx % 2 === 0 ? "bg-background hover:bg-muted/50" : "bg-muted/20 hover:bg-muted/50"
                                }`}
                              >
                                <td className="px-3 py-2.5 text-left leading-snug">{phase.label}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium">{phase.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-muted/50 px-3 py-2.5 border-t border-border">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>Total da obra:</span>
                      <span>{fmt(totalCusto)}</span>
                    </div>
                  </div>
                </div>

                {/* Right panel - service cards like reference image */}
                <div className="flex-1 border border-l-0 border-border rounded-r-lg flex flex-col">
                  {/* Phase title header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">{activePhaseLabel || "Todos os serviços"}</h4>
                    <button onClick={() => { setItemForm({ description: "", category: activePhaseLabel || "", quantity: "1", unit: "un", unit_price: "0" }); setEditingItem(null); setAddingItem(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                      <Plus className="h-3.5 w-3.5" /> Adicionar item
                    </button>
                  </div>

                  {/* Scrollable service cards */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "55vh" }}>
                    {displayItems.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">Nenhum item nesta fase.</div>
                    ) : (
                      displayItems.map((item) => (
                        <div key={item.id} className="border border-border rounded-lg bg-background">
                          {/* Service title bar */}
                          <div className="bg-muted/40 px-4 py-2.5 rounded-t-lg flex items-center justify-between border-b border-border">
                            <span className="text-sm font-semibold text-foreground">{item.description}</span>
                            <div className="flex gap-1">
                              <button onClick={() => openEditItem(item)} className="p-1.5 rounded hover:bg-accent text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm("Remover item?")) deleteItem.mutate(item.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>

                          {/* Service details */}
                          <div className="p-4 space-y-3">
                            {/* Row: Quantidade + Unidade + Valor unitário + Valor total */}
                            <div className="flex items-center gap-6 flex-wrap text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Quantidade</span>
                                <span className="px-2 py-1 border border-input rounded bg-muted/30 text-foreground text-sm font-medium tabular-nums min-w-[70px] text-center">
                                  {(item.quantity ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-muted-foreground text-xs uppercase">{item.unit || "UN"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Valor unitário:</span>
                                <span className="font-medium text-foreground">{fmt(item.unit_price)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Valor total:</span>
                                <span className="font-bold text-foreground">{fmt(item.total_price)}</span>
                              </div>
                            </div>

                            {/* Tipos de custo section */}
                            <div className="border-t border-border pt-3">
                              <span className="text-xs font-semibold text-primary">Tipos de custo</span>
                              <div className="flex items-center gap-6 mt-2 text-sm">
                                <span className="text-muted-foreground text-xs">Serviço</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Valor unitário</span>
                                  <span className="px-2 py-1 border border-input rounded bg-muted/30 text-foreground text-sm font-medium tabular-nums">
                                    R$ {(item.unit_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Valor total:</span>
                                  <span className="font-bold text-foreground">{fmt(item.total_price)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Bottom totals bar */}
                  <div className="border-t border-border px-4 py-2.5 flex gap-6 bg-muted/30">
                    <div className="flex items-center gap-2 border border-primary/30 rounded px-3 py-1.5 bg-primary/5">
                      <span className="text-xs font-semibold text-foreground">Total da obra:</span>
                      <span className="text-xs font-bold text-foreground">{fmt(totalCusto)}</span>
                    </div>
                    {activePhaseLabel && (
                      <div className="flex items-center gap-2 border border-border rounded px-3 py-1.5">
                        <span className="text-xs font-semibold text-foreground">Total da fase:</span>
                        <span className="text-xs font-bold text-foreground">{fmt(displayItems.reduce((s, i) => s + (i.total_price || 0), 0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "valores_venda" && (() => {
            const phaseItemsVenda = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItemsVenda = items.filter((i) => (i.category || "").toLowerCase() === "serviço" || (i.category || "").toLowerCase() === "servico");

            const getDescPrefixVenda = (desc: string) => {
              const match = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return match ? match[1] : null;
            };

            const vendaPhaseRows = phaseItemsVenda
              .map((p) => {
                const prefix = getDescPrefixVenda(p.description);
                const rootIndex = prefix ? prefix.split(".")[0] : null;
                if (!rootIndex || prefix !== rootIndex) return null;

                const total = serviceItemsVenda
                  .filter((s) => {
                    const sPrefix = getDescPrefixVenda(s.description);
                    return sPrefix ? sPrefix.split(".")[0] === rootIndex : false;
                  })
                  .reduce((sum, s) => {
                    const bdi = (s as any).bdi || 0;
                    return sum + (s.total_price || 0) * (1 + bdi / 100);
                  }, 0);

                return { rootIndex, label: p.description, total };
              })
              .filter((v): v is { rootIndex: string; label: string; total: number } => !!v)
              .filter((v, i, arr) => arr.findIndex((a) => a.rootIndex === v.rootIndex) === i)
              .sort((a, b) => Number.parseInt(a.rootIndex, 10) - Number.parseInt(b.rootIndex, 10));

            const vendaFallbackRows = vendaPhaseRows.length === 0
              ? [...new Set(items.map((i) => (i.category || "Geral").trim()))].map((cat) => ({
                  rootIndex: cat,
                  label: cat,
                  total: items.filter((i) => (i.category || "Geral").trim() === cat).reduce((sum, i) => {
                    const bdi = (i as any).bdi || 0;
                    return sum + (i.total_price || 0) * (1 + bdi / 100);
                  }, 0),
                }))
              : [];

            const vendaRows = vendaPhaseRows.length > 0 ? vendaPhaseRows : vendaFallbackRows;

            const activeVendaRow = selectedPhase
              ? vendaRows.find((r) => r.label === selectedPhase)
              : null;

            const activeVendaLabel = activeVendaRow?.label ?? null;

            const vendaDisplayItems = activeVendaRow
              ? serviceItemsVenda.filter((s) => {
                  const sPrefix = getDescPrefixVenda(s.description);
                  return sPrefix ? sPrefix.split(".")[0] === activeVendaRow.rootIndex : false;
                })
              : serviceItemsVenda.length > 0 ? serviceItemsVenda : items;

            const totalVenda = (serviceItemsVenda.length > 0 ? serviceItemsVenda : items).reduce((s, i) => {
              const bdi = (i as any).bdi || 0;
              return s + (i.total_price || 0) * (1 + bdi / 100);
            }, 0);

            const updateBdi = async (itemId: string, bdiValue: number) => {
              await supabase.from("budget_items").update({ bdi: bdiValue } as any).eq("id", itemId);
              qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
            };

            return (
              <div className="flex gap-0 h-full">
                {/* Phase sidebar - same layout as valores_custo */}
                <div className="w-80 flex-shrink-0 border border-border rounded-l-lg overflow-hidden flex flex-col">
                  <div className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground">Fase da obra</span>
                    <span className="text-xs font-semibold text-muted-foreground">Total (R$)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {vendaRows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">
                              Nenhuma fase encontrada.
                            </td>
                          </tr>
                        ) : (
                          vendaRows.map((phase, idx) => {
                            const isActive = activeVendaRow?.label === phase.label;
                            return (
                              <tr
                                key={phase.rootIndex}
                                onClick={() => setSelectedPhase(phase.label)}
                                className={`cursor-pointer border-b border-border transition-colors ${
                                  isActive ? "bg-primary/10 font-bold text-primary" : idx % 2 === 0 ? "bg-background hover:bg-muted/50" : "bg-muted/20 hover:bg-muted/50"
                                }`}
                              >
                                <td className="px-3 py-2.5 text-left leading-snug">{phase.label}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium">{phase.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-muted/50 px-3 py-2.5 border-t border-border">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>Total da obra:</span>
                      <span>{fmt(totalVenda)}</span>
                    </div>
                  </div>
                </div>

                {/* Right panel - service cards with BDI */}
                <div className="flex-1 border border-l-0 border-border rounded-r-lg flex flex-col">
                  <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">{activeVendaLabel || "Todos os serviços"}</h4>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "55vh" }}>
                    {vendaDisplayItems.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">Nenhum item nesta fase.</div>
                    ) : (
                      vendaDisplayItems.map((item) => {
                        const bdi = (item as any).bdi || 0;
                        const vendaUnit = (item.unit_price || 0) * (1 + bdi / 100);
                        const vendaTotal = (item.total_price || 0) * (1 + bdi / 100);
                        return (
                          <div key={item.id} className="border border-border rounded-lg bg-background">
                            <div className="bg-muted/40 px-4 py-2.5 rounded-t-lg border-b border-border">
                              <span className="text-sm font-semibold text-foreground">{item.description}</span>
                            </div>
                            <div className="p-4">
                              <div className="flex items-center gap-6 text-sm flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Custo unit.:</span>
                                  <span className="text-foreground">{fmt(item.unit_price)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Custo total:</span>
                                  <span className="text-foreground">{fmt(item.total_price)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">BDI (%):</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    defaultValue={bdi}
                                    onBlur={(e) => updateBdi(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 rounded border border-input bg-background text-foreground text-sm text-right"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Venda unit.:</span>
                                  <span className="font-semibold text-foreground">{fmt(vendaUnit)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">Venda total:</span>
                                  <span className="font-bold text-primary">{fmt(vendaTotal)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-border px-4 py-2.5 flex gap-6 bg-muted/30">
                    <div className="flex items-center gap-2 border border-primary/30 rounded px-3 py-1.5 bg-primary/5">
                      <span className="text-xs font-semibold text-foreground">Total venda:</span>
                      <span className="text-xs font-bold text-foreground">{fmt(totalVenda)}</span>
                    </div>
                    {activeVendaRow && (
                      <div className="flex items-center gap-2 border border-border rounded px-3 py-1.5">
                        <span className="text-xs font-semibold text-foreground">Total da fase:</span>
                        <span className="text-xs font-bold text-foreground">{fmt(vendaDisplayItems.reduce((s, i) => {
                          const bdi = (i as any).bdi || 0;
                          return s + (i.total_price || 0) * (1 + bdi / 100);
                        }, 0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "insumos" && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Insumos utilizados</h4>
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum insumo cadastrado. Adicione itens na aba "Valores custo".</div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Unidade</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qtd Total</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Preço Unit.</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <tr key={item.id} className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                          <td className="px-3 py-2 text-foreground">{item.description}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.unit || "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{item.quantity ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">{fmt(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t border-border">
                        <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-foreground">Total:</td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(totalCusto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "curva_abc" && (() => {
            const getPrefix = (desc: string) => {
              const m = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return m ? m[1] : null;
            };

            const phaseItems = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItems = items
              .filter((i) => (i.category || "").toLowerCase() === "serviço" || (i.category || "").toLowerCase() === "servico")
              .filter((i) => (i.total_price || 0) > 0);

            // Group services by root phase index
            const phaseMap = new Map<string, { label: string; total: number; services: typeof serviceItems }>();
            const rootPhases = phaseItems.filter((p) => {
              const pfx = getPrefix(p.description);
              return pfx && !pfx.includes(".");
            });

            rootPhases.forEach((phase) => {
              const rootIdx = getPrefix(phase.description)!;
              const children = serviceItems.filter((s) => {
                const sp = getPrefix(s.description);
                return sp ? sp.split(".")[0] === rootIdx : false;
              });
              const total = children.reduce((sum, s) => sum + (s.total_price || 0), 0);
              if (total > 0) {
                phaseMap.set(rootIdx, { label: phase.description, total, services: children });
              }
            });

            // Sort phases by total descending for ABC
            const phaseArr = [...phaseMap.entries()].sort((a, b) => b[1].total - a[1].total);
            const grandTotal = phaseArr.reduce((s, [, v]) => s + v.total, 0);
            let cumPhase = 0;


            return (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Curva ABC por Fases</h4>
                {phaseArr.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma fase com serviços cadastrados.</div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-16">Classe</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Fase</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Valor</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">% Individual</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">% Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {phaseArr.map(([rootIdx, { label, total, services }], idx) => {
                          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                          cumPhase += pct;
                          const cls = cumPhase <= 80 ? "A" : cumPhase <= 95 ? "B" : "C";
                          const clsBg = cls === "A" ? "bg-green-600 text-white" : cls === "B" ? "bg-amber-500 text-white" : "bg-red-600 text-white";
                          const isOpen = expandedAbc === rootIdx;
                          const sortedSvc = [...services].sort((a, b) => (b.total_price || 0) - (a.total_price || 0));
                          const svcTotal = total;
                          let cumSvc = 0;

                          return (
                            <>
                              <tr
                                key={rootIdx}
                                className={`cursor-pointer hover:bg-muted/40 ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                                onClick={() => setExpandedAbc(isOpen ? null : rootIdx)}
                              >
                                <td className="px-3 py-2"><span className={`inline-flex items-center justify-center w-7 h-7 rounded font-bold text-xs ${clsBg}`}>{cls}</span></td>
                                <td className="px-3 py-2 text-foreground font-medium flex items-center gap-1.5">
                                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                                  {label}
                                </td>
                                <td className="px-3 py-2 text-right text-foreground tabular-nums font-medium">{fmt(total)}</td>
                                <td className="px-3 py-2 text-right text-foreground tabular-nums">{pct.toFixed(2)}%</td>
                                <td className="px-3 py-2 text-right text-foreground tabular-nums">{cumPhase.toFixed(2)}%</td>
                              </tr>
                              {isOpen && sortedSvc.map((svc, si) => {
                                const sPct = svcTotal > 0 ? ((svc.total_price || 0) / svcTotal) * 100 : 0;
                                cumSvc += sPct;
                                const sCls = cumSvc <= 80 ? "A" : cumSvc <= 95 ? "B" : "C";
                                const sClsBg = sCls === "A" ? "bg-green-500 text-white" : sCls === "B" ? "bg-amber-400 text-white" : "bg-red-500 text-white";
                                return (
                                  <tr key={svc.id} className="bg-muted/10">
                                    <td className="px-3 py-1.5 pl-8"><span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${sClsBg}`}>{sCls}</span></td>
                                    <td className="px-3 py-1.5 pl-10 text-foreground text-xs">{svc.description}</td>
                                    <td className="px-3 py-1.5 text-right text-foreground text-xs tabular-nums">{fmt(svc.total_price)}</td>
                                    <td className="px-3 py-1.5 text-right text-foreground text-xs tabular-nums">{sPct.toFixed(2)}%</td>
                                    <td className="px-3 py-1.5 text-right text-foreground text-xs tabular-nums">{cumSvc.toFixed(2)}%</td>
                                  </tr>
                                );
                              })}
                            </>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 border-t border-border">
                          <td colSpan={2} className="px-3 py-2.5 text-right font-semibold text-foreground">Total:</td>
                          <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(grandTotal)}</td>
                          <td colSpan={2} className="px-3 py-2.5 text-right font-bold text-foreground">100,00%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "cronograma" && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Cronograma da Obra</h4>
              <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">Módulo de cronograma em desenvolvimento.</p>
                <p className="text-xs mt-1">Aqui será possível definir prazos por fase e acompanhar o andamento.</p>
              </div>
            </div>
          )}

          {activeTab === "planejamento" && (() => {
            const getPrefixPlan = (desc: string) => {
              const m = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return m ? m[1] : null;
            };
            const phaseItemsPlan = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItemsPlan = items.filter((i) => ["serviço", "servico"].includes((i.category || "").toLowerCase()));
            const rootPhasesPlan = phaseItemsPlan.filter((p) => {
              const pfx = getPrefixPlan(p.description);
              return pfx && !pfx.includes(".");
            });
            const phaseDataPlan = rootPhasesPlan.map((phase) => {
              const rootIdx = getPrefixPlan(phase.description)!;
              const children = serviceItemsPlan.filter((s) => {
                const sp = getPrefixPlan(s.description);
                return sp ? sp.split(".")[0] === rootIdx : false;
              });
              const total = children.reduce((sum, s) => sum + (s.total_price || 0), 0);
              return { rootIdx, label: phase.description, total, services: children };
            }).filter((p) => p.services.length > 0).sort((a, b) => parseInt(a.rootIdx) - parseInt(b.rootIdx));

            const addPlanPeriod = async () => {
              if (!user) return;
              const now = new Date();
              const nextOrder = planPeriods.length;
              const { data, error } = await supabase
                .from("budget_plan_periods" as any)
                .insert({
                  budget_id: budgetId,
                  period_date: now.toISOString().split("T")[0],
                  period_label: `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
                  sort_order: nextOrder,
                  user_id: user.id,
                } as any)
                .select()
                .single();
              if (error) { toast.error(error.message); return; }
              // Create plan items for all services
              const itemsToInsert = serviceItemsPlan.map((svc) => ({
                plan_period_id: (data as any).id,
                budget_item_id: svc.id,
                planned_percentage: 0,
              }));
              if (itemsToInsert.length > 0) {
                await supabase.from("budget_plan_items" as any).insert(itemsToInsert as any);
              }
              qc.invalidateQueries({ queryKey: ["budget_plan_periods", budgetId] });
              qc.invalidateQueries({ queryKey: ["budget_plan_items", budgetId] });
              toast.success("Período adicionado!");
            };

            const deletePlanPeriod = async (periodId: string) => {
              if (!confirm("Excluir este período de planejamento?")) return;
              await supabase.from("budget_plan_items" as any).delete().eq("plan_period_id", periodId);
              await supabase.from("budget_plan_periods" as any).delete().eq("id", periodId);
              qc.invalidateQueries({ queryKey: ["budget_plan_periods", budgetId] });
              qc.invalidateQueries({ queryKey: ["budget_plan_items", budgetId] });
              toast.success("Período excluído!");
            };

            const updatePlanPeriodDate = async (periodId: string, newDate: string) => {
              await supabase.from("budget_plan_periods" as any).update({ period_date: newDate } as any).eq("id", periodId);
              qc.invalidateQueries({ queryKey: ["budget_plan_periods", budgetId] });
            };

            const updatePlanPeriodLabel = async (periodId: string, label: string) => {
              await supabase.from("budget_plan_periods" as any).update({ period_label: label } as any).eq("id", periodId);
              qc.invalidateQueries({ queryKey: ["budget_plan_periods", budgetId] });
            };

            const updatePlanItemPct = async (planItemId: string, pct: number) => {
              await supabase.from("budget_plan_items" as any).update({ planned_percentage: pct } as any).eq("id", planItemId);
              qc.invalidateQueries({ queryKey: ["budget_plan_items", budgetId] });
            };

            const getPlanAccPct = (budgetItemId: string) => {
              return planItems
                .filter((pi: any) => pi.budget_item_id === budgetItemId)
                .reduce((sum: number, pi: any) => sum + (pi.planned_percentage || 0), 0);
            };

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Planejamento Físico/Econômico</h4>
                  <button
                    onClick={addPlanPeriod}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar período
                  </button>
                </div>

                {planPeriods.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm">Nenhum período de planejamento cadastrado.</p>
                    <p className="text-xs mt-1">Adicione períodos para planejar as medições previstas até o fim da obra.</p>
                  </div>
                ) : (
                  <div className="flex gap-4" style={{ minHeight: 400 }}>
                    {/* Sidebar: phases */}
                    <div className="w-72 border border-border rounded-lg overflow-hidden flex-shrink-0">
                      <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Fases da Obra</div>
                      <div className="divide-y divide-border max-h-[500px] overflow-auto">
                        {phaseDataPlan.map(({ rootIdx, label, total, services }) => {
                          const accPlanPct = services.reduce((sum, svc) => sum + getPlanAccPct(svc.id), 0);
                          const avgPct = services.length > 0 ? accPlanPct / services.length : 0;
                          const isSelected = planSelectedPhase === rootIdx;
                          return (
                            <button
                              key={rootIdx}
                              onClick={() => setPlanSelectedPhase(isSelected ? null : rootIdx)}
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                            >
                              <div className="font-medium text-foreground truncate">{label}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-muted-foreground">{fmt(total)}</span>
                                <span className="text-xs font-medium text-primary">{avgPct.toFixed(1)}% plan.</span>
                              </div>
                              <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.min(avgPct, 100)}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: periods and services */}
                    <div className="flex-1 overflow-auto">
                      {!planSelectedPhase ? (
                        <div className="space-y-3">
                          {/* Periods listing */}
                          <div className="border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Período</th>
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Data</th>
                                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">% Previsto Médio</th>
                                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {planPeriods.map((period: any, idx: number) => {
                                  const periodItems = planItems.filter((pi: any) => pi.plan_period_id === period.id);
                                  const avgPct = periodItems.length > 0
                                    ? periodItems.reduce((s: number, pi: any) => s + (pi.planned_percentage || 0), 0) / periodItems.length
                                    : 0;
                                  return (
                                    <tr key={period.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          defaultValue={period.period_label || ""}
                                          onBlur={(e) => updatePlanPeriodLabel(period.id, e.target.value)}
                                          className="w-32 px-2 py-1 text-sm rounded border border-input bg-background text-foreground"
                                          placeholder="Ex: 01/2025"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          defaultValue={period.period_date}
                                          onBlur={(e) => updatePlanPeriodDate(period.id, e.target.value)}
                                          className="px-2 py-1 text-sm rounded border border-input bg-background text-foreground"
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right text-foreground tabular-nums">{avgPct.toFixed(1)}%</td>
                                      <td className="px-3 py-2 text-center">
                                        <button
                                          onClick={() => deletePlanPeriod(period.id)}
                                          className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90"
                                          title="Excluir período"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-muted-foreground">Selecione uma fase ao lado para lançar as previsões por serviço e período.</p>
                        </div>
                      ) : (() => {
                        const phaseData = phaseDataPlan.find((p) => p.rootIdx === planSelectedPhase);
                        if (!phaseData) return null;
                        return (
                          <div className="space-y-3">
                            <h5 className="text-sm font-semibold text-foreground mb-2">{phaseData.label}</h5>
                            {/* Grid: services x periods */}
                            <div className="border border-border rounded-lg overflow-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[200px] sticky left-0 bg-muted/50 z-10">Serviço</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground min-w-[80px]">Total</th>
                                    {planPeriods.map((period: any) => (
                                      <th key={period.id} className="text-center px-2 py-2 font-medium text-muted-foreground min-w-[90px]">
                                        {period.period_label || new Date(period.period_date).toLocaleDateString("pt-BR")}
                                      </th>
                                    ))}
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground min-w-[80px]">Acum. Plan.</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground min-w-[80px]">Saldo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {phaseData.services.map((svc, idx) => {
                                    const accPlan = getPlanAccPct(svc.id);
                                    const saldoPct = 100 - accPlan;
                                    return (
                                      <tr key={svc.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                        <td className="px-3 py-2 text-foreground sticky left-0 bg-inherit z-10">
                                          <div className="text-xs font-medium truncate max-w-[200px]">{svc.description}</div>
                                          <div className="text-[10px] text-muted-foreground">{svc.quantity} {svc.unit} — {fmt(svc.unit_price)}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-foreground tabular-nums text-xs">{fmt(svc.total_price)}</td>
                                        {planPeriods.map((period: any) => {
                                          const pi = planItems.find((item: any) => item.plan_period_id === period.id && item.budget_item_id === svc.id);
                                          return (
                                            <td key={period.id} className="px-1 py-1.5 text-center">
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                defaultValue={pi?.planned_percentage || 0}
                                                key={`plan-${pi?.id}-${pi?.planned_percentage}`}
                                                onBlur={(e) => {
                                                  if (pi) updatePlanItemPct(pi.id, parseFloat(e.target.value) || 0);
                                                }}
                                                className="w-full px-1.5 py-1 text-xs rounded border border-input bg-background text-foreground tabular-nums text-center"
                                                disabled={!pi}
                                              />
                                            </td>
                                          );
                                        })}
                                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                                          <span className={accPlan > 100 ? "text-destructive font-bold" : "text-primary font-medium"}>{accPlan.toFixed(1)}%</span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                                          <span className={saldoPct < 0 ? "text-destructive" : "text-muted-foreground"}>{saldoPct.toFixed(1)}%</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "medicao" && (() => {
            const getPrefixMed = (desc: string) => {
              const m = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return m ? m[1] : null;
            };
            const phaseItemsMed = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItemsMed = items
              .filter((i) => (i.category || "").toLowerCase() === "serviço" || (i.category || "").toLowerCase() === "servico");

            const rootPhasesMed = phaseItemsMed.filter((p) => {
              const pfx = getPrefixMed(p.description);
              return pfx && !pfx.includes(".");
            });

            const phaseDataMed = rootPhasesMed.map((phase) => {
              const rootIdx = getPrefixMed(phase.description)!;
              const children = serviceItemsMed.filter((s) => {
                const sp = getPrefixMed(s.description);
                return sp ? sp.split(".")[0] === rootIdx : false;
              });
              const total = children.reduce((sum, s) => sum + (s.total_price || 0), 0);
              return { rootIdx, label: phase.description, total, services: children };
            }).filter((p) => p.services.length > 0).sort((a, b) => parseInt(a.rootIdx) - parseInt(b.rootIdx));

            const createMeasurement = async () => {
              if (!user) return;
              const nextNum = measurements.length > 0 ? Math.max(...measurements.map((m: any) => m.measurement_number)) + 1 : 1;
              const now = new Date();
              const period = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

              const { data, error } = await supabase
                .from("budget_measurements")
                .insert({
                  budget_id: budgetId,
                  measurement_number: nextNum,
                  reference_period: period,
                  user_id: user.id,
                } as any)
                .select()
                .single();
              if (error) { toast.error(error.message); return; }

              // New measurement starts at 0 — each measurement records only the increment for that period
              const itemsToInsert = serviceItemsMed.map((svc) => ({
                measurement_id: (data as any).id,
                budget_item_id: svc.id,
                measured_quantity: 0,
                measured_percentage: 0,
              }));
              if (itemsToInsert.length > 0) {
                await supabase.from("budget_measurement_items").insert(itemsToInsert as any);
              }

              qc.invalidateQueries({ queryKey: ["budget_measurements", budgetId] });
              qc.invalidateQueries({ queryKey: ["all_budget_measurement_items", budgetId] });
              setActiveMeasurement((data as any).id);
              toast.success(`Medição #${nextNum} criada!`);
            };

            const updateMeasuredField = async (itemId: string, budgetItemId: string, field: "pct" | "value", val: number) => {
              const svc = serviceItemsMed.find((s) => s.id === budgetItemId);
              if (!svc) return;
              let pct: number, qty: number;
              if (field === "pct") {
                pct = val;
                qty = (svc.quantity || 0) * (pct / 100);
              } else {
                const totalP = svc.total_price || 0;
                pct = totalP > 0 ? (val / totalP) * 100 : 0;
                qty = (svc.quantity || 0) * (pct / 100);
              }
              await supabase.from("budget_measurement_items").update({
                measured_percentage: pct,
                measured_quantity: qty,
                measured_at: new Date().toISOString(),
              } as any).eq("id", itemId);
              qc.invalidateQueries({ queryKey: ["budget_measurement_items", activeMeasurement] });
              qc.invalidateQueries({ queryKey: ["all_budget_measurement_items", budgetId] });
            };

            const closeMeasurement = async () => {
              if (!activeMeasurement) return;
              await supabase.from("budget_measurements").update({ status: "fechada", closed_at: new Date().toISOString() } as any).eq("id", activeMeasurement);
              qc.invalidateQueries({ queryKey: ["budget_measurements", budgetId] });
              setActiveMeasurement(null);
              toast.success("Medição fechada!");
            };

            const deleteMeasurement = async (medId: string) => {
              if (!confirm("Deseja realmente excluir esta medição? Todos os lançamentos serão perdidos.")) return;
              await supabase.from("budget_measurement_items").delete().eq("measurement_id", medId);
              const { error } = await supabase.from("budget_measurements").delete().eq("id", medId);
              if (error) { toast.error(error.message); return; }
              if (activeMeasurement === medId) setActiveMeasurement(null);
              qc.invalidateQueries({ queryKey: ["budget_measurements", budgetId] });
              qc.invalidateQueries({ queryKey: ["all_budget_measurement_items", budgetId] });
              toast.success("Medição excluída!");
            };

            // Helper: get accumulated measured percentage for a budget item across ALL measurements
            const getAccumulatedPct = (budgetItemId: string) => {
              return (allMeasurementItems as any[])
                .filter((mi: any) => mi.budget_item_id === budgetItemId)
                .reduce((sum: number, mi: any) => sum + (mi.measured_percentage || 0), 0);
            };

            // Helper: get accumulated percentage from all measurements BEFORE the active one
            const getPreviousAccumulatedPct = (budgetItemId: string) => {
              if (!activeMeasurement) return 0;
              const prevMeasurementIds = measurements
                .filter((m: any) => m.id !== activeMeasurement)
                .filter((m: any) => {
                  const activeMedObj = measurements.find((mm: any) => mm.id === activeMeasurement) as any;
                  return activeMedObj ? m.measurement_number < activeMedObj.measurement_number : false;
                })
                .map((m: any) => m.id);
              return (allMeasurementItems as any[])
                .filter((mi: any) => mi.budget_item_id === budgetItemId && prevMeasurementIds.includes(mi.measurement_id))
                .reduce((sum: number, mi: any) => sum + (mi.measured_percentage || 0), 0);
            };

            const activeMed = measurements.find((m: any) => m.id === activeMeasurement) as any;

            // Generate measurement report PDF
            const generateMeasurementReport = async () => {
              try {
                const companyInfo = user?.id ? await fetchCompanyInfo(user.id) : null;
                const doc = new jsPDF({ orientation: "landscape" });
                let y = 15;

                // Company header
                if (companyInfo) {
                  if (companyInfo.logo_url) {
                    try {
                      const img = new Image();
                      img.crossOrigin = "anonymous";
                      const imgData = await new Promise<string>((resolve, reject) => {
                        img.onload = () => {
                          const canvas = document.createElement("canvas");
                          canvas.width = img.width;
                          canvas.height = img.height;
                          canvas.getContext("2d")!.drawImage(img, 0, 0);
                          resolve(canvas.toDataURL("image/jpeg"));
                        };
                        img.onerror = reject;
                        img.src = companyInfo.logo_url!;
                      });
                      doc.addImage(imgData, "JPEG", 14, 10, 25, 25);
                      y = 12;
                    } catch { /* skip logo */ }
                  }
                  const textX = companyInfo.logo_url ? 44 : 14;
                  doc.setFontSize(14);
                  doc.setFont("helvetica", "bold");
                  if (companyInfo.company_name) { doc.text(companyInfo.company_name, textX, y); y += 6; }
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "normal");
                  if (companyInfo.document) { doc.text(`CNPJ/CPF: ${companyInfo.document}`, textX, y); y += 4; }
                  const addrParts = [companyInfo.address, companyInfo.city, companyInfo.state].filter(Boolean).join(" - ");
                  if (addrParts) { doc.text(addrParts, textX, y); y += 4; }
                  if (companyInfo.phone) { doc.text(`Tel: ${companyInfo.phone}`, textX, y); y += 4; }
                  if (companyInfo.email) { doc.text(companyInfo.email, textX, y); y += 4; }
                  y += 4;
                }

                // Report title
                doc.setFontSize(13);
                doc.setFont("helvetica", "bold");
                doc.text(`Relatório de Medições — ${budget.budget_code || ""} — ${obra?.name || ""}`, 14, y);
                y += 8;

                // Overall summary
                const totalOrcado = serviceItemsMed.reduce((s, svc) => s + (svc.total_price || 0), 0);
                const totalMedidoAcc = serviceItemsMed.reduce((sum, svc) => {
                  const accPct = getAccumulatedPct(svc.id);
                  return sum + (svc.total_price || 0) * (accPct / 100);
                }, 0);
                const totalSaldo = totalOrcado - totalMedidoAcc;
                const progressPct = totalOrcado > 0 ? Math.min((totalMedidoAcc / totalOrcado) * 100, 100) : 0;

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Total Orçado: ${fmt(totalOrcado)}   |   Medido Acumulado: ${fmt(totalMedidoAcc)} (${progressPct.toFixed(1)}%)   |   Saldo Restante: ${fmt(totalSaldo)}`, 14, y);
                y += 8;

                // Measurements summary table
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.text("Medições Realizadas", 14, y);
                y += 2;

                autoTable(doc, {
                  startY: y,
                  head: [["Nº", "Período", "Status", "Criação", "Valor Medido"]],
                  body: measurements.map((med: any) => {
                    const medItems = (allMeasurementItems as any[]).filter((mi: any) => mi.measurement_id === med.id);
                    const medValue = medItems.reduce((sum: number, mi: any) => {
                      const svc = serviceItemsMed.find(s => s.id === mi.budget_item_id);
                      return sum + ((svc?.total_price || 0) * ((mi.measured_percentage || 0) / 100));
                    }, 0);
                    return [
                      `#${med.measurement_number}`,
                      med.reference_period || "—",
                      med.status === "aberta" ? "Aberta" : "Fechada",
                      new Date(med.created_at).toLocaleDateString("pt-BR"),
                      fmt(medValue),
                    ];
                  }),
                  styles: { fontSize: 8, cellPadding: 2 },
                  headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
                  alternateRowStyles: { fillColor: [245, 245, 245] },
                });

                y = (doc as any).lastAutoTable.finalY + 10;

                // Detail per phase/item
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                if (y > 170) { doc.addPage(); y = 15; }
                doc.text("Detalhamento por Item", 14, y);
                y += 2;

                const detailBody = serviceItemsMed.map((svc) => {
                  const accPct = getAccumulatedPct(svc.id);
                  const accValue = (svc.total_price || 0) * (accPct / 100);
                  const saldo = (svc.total_price || 0) - accValue;
                  return [
                    svc.category || "—",
                    svc.description,
                    `${svc.quantity ?? 0} ${svc.unit || ""}`,
                    fmt(svc.unit_price),
                    fmt(svc.total_price),
                    `${accPct.toFixed(2)}%`,
                    fmt(accValue),
                    fmt(saldo),
                  ];
                });

                autoTable(doc, {
                  startY: y,
                  head: [["Fase", "Descrição", "Qtd", "Unit.", "Total Orçado", "% Acum.", "Valor Acum.", "Saldo"]],
                  body: detailBody,
                  styles: { fontSize: 7, cellPadding: 1.5 },
                  headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
                  alternateRowStyles: { fillColor: [245, 245, 245] },
                  columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 60 },
                  },
                });

                doc.save(`Relatorio_Medicoes_${budget.budget_code || budgetId}.pdf`);
                toast.success("Relatório gerado com sucesso!");
              } catch (err: any) {
                toast.error("Erro ao gerar relatório: " + (err?.message || ""));
              }
            };

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Medição Física</h4>
                  <div className="flex items-center gap-2">
                    {measurements.length > 0 && (
                      <button
                        onClick={() => generateMeasurementReport()}
                        className="flex items-center gap-1.5 px-4 py-2 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted"
                      >
                        <Download className="h-4 w-4" />
                        Relatório
                      </button>
                    )}
                    <button
                      onClick={createMeasurement}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      Abrir medição
                    </button>
                  </div>
                </div>

                {/* Overall progress bar on main listing */}
                {measurements.length > 0 && !activeMeasurement && (() => {
                  const totalOrcado = serviceItemsMed.reduce((s, svc) => s + (svc.total_price || 0), 0);
                  const totalMedidoAcc = serviceItemsMed.reduce((sum, svc) => {
                    const accPct = getAccumulatedPct(svc.id);
                    return sum + (svc.total_price || 0) * (accPct / 100);
                  }, 0);
                  const totalSaldo = totalOrcado - totalMedidoAcc;
                  const progressPct = totalOrcado > 0 ? Math.min((totalMedidoAcc / totalOrcado) * 100, 100) : 0;
                  return (
                    <div className="bg-muted/50 rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">Progresso Geral da Obra</span>
                        <span className="text-sm font-bold text-primary">{progressPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-4 bg-muted rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct >= 100
                              ? 'hsl(var(--chart-2))'
                              : progressPct >= 50
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--chart-4))',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>Valor da Obra: <strong className="text-foreground">{fmt(totalOrcado)}</strong></span>
                        <span>Medido: <strong className="text-primary">{fmt(totalMedidoAcc)}</strong></span>
                        <span>Saldo: <strong className={totalSaldo > 0 ? "text-foreground" : totalSaldo === 0 ? "text-green-600" : "text-destructive"}>{fmt(totalSaldo)}</strong></span>
                      </div>
                    </div>
                  );
                })()}

                {measurements.length === 0 && !activeMeasurement ? (
                  <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm">Nenhuma medição cadastrada.</p>
                    <p className="text-xs mt-1">Clique em "Abrir medição" para iniciar a primeira medição periódica.</p>
                  </div>
                ) : !activeMeasurement ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Nº</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Período</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Criação</th>
                          <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {measurements.map((med: any, idx: number) => (
                          <tr key={med.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                            <td className="px-3 py-2 font-medium text-foreground">#{med.measurement_number}</td>
                            <td className="px-3 py-2 text-foreground">{med.reference_period || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${med.status === "aberta" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                {med.status === "aberta" ? "Aberta" : "Fechada"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{new Date(med.created_at).toLocaleDateString("pt-BR")}</td>
                            <td className="px-3 py-2 text-center flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setActiveMeasurement(med.id)}
                                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                              >
                                {med.status === "aberta" ? "Editar" : "Visualizar"}
                              </button>
                              <button
                                onClick={() => deleteMeasurement(med.id)}
                                className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90"
                                title="Excluir medição"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/30 rounded-lg border border-border p-3">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-semibold text-foreground">Medição #{activeMed?.measurement_number}</span>
                        <span className="text-muted-foreground">Período: {activeMed?.reference_period || "—"}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${activeMed?.status === "aberta" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {activeMed?.status === "aberta" ? "Aberta" : "Fechada"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeMed?.status === "aberta" && (
                          <button onClick={closeMeasurement} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:opacity-90 font-medium">
                            Fechar medição
                          </button>
                        )}
                        <button
                          onClick={() => deleteMeasurement(activeMeasurement!)}
                          className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 font-medium"
                        >
                          Excluir medição
                        </button>
                        <button onClick={() => setActiveMeasurement(null)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-foreground">
                          Voltar
                        </button>
                      </div>
                    </div>

                    {/* Phase-based layout */}
                    <div className="flex gap-4" style={{ minHeight: 400 }}>
                      {/* Sidebar: phases */}
                      <div className="w-72 border border-border rounded-lg overflow-hidden flex-shrink-0">
                        <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Fases da Obra</div>
                        <div className="divide-y divide-border">
                          {phaseDataMed.map(({ rootIdx, label, total, services }) => {
                            const accumulatedTotal = services.reduce((sum, svc) => {
                              const accPct = getAccumulatedPct(svc.id);
                              return sum + (svc.total_price || 0) * (accPct / 100);
                            }, 0);
                            const phasePct = total > 0 ? (accumulatedTotal / total) * 100 : 0;
                            const saldo = total - accumulatedTotal;
                            const isSelected = selectedPhase === rootIdx;
                            return (
                              <button
                                key={rootIdx}
                                onClick={() => setSelectedPhase(isSelected ? null : rootIdx)}
                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                              >
                                <div className="font-medium text-foreground truncate">{label}</div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-muted-foreground">{fmt(accumulatedTotal)} / {fmt(total)}</span>
                                  <span className="text-xs font-medium text-primary">{phasePct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(phasePct, 100)}%` }} />
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">Saldo: {fmt(saldo)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: services of selected phase */}
                      <div className="flex-1 overflow-auto">
                        {!selectedPhase ? (
                          <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                            <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                            <p className="text-sm">Selecione uma fase ao lado para lançar medições.</p>
                          </div>
                        ) : (() => {
                          const phaseData = phaseDataMed.find((p) => p.rootIdx === selectedPhase);
                          if (!phaseData) return null;
                          return (
                            <div className="space-y-2">
                              <h5 className="text-sm font-semibold text-foreground mb-2">{phaseData.label}</h5>
                              {phaseData.services.map((svc, idx) => {
                                const mi = measurementItems.find((m: any) => m.budget_item_id === svc.id) as any;
                                const pct = mi?.measured_percentage || 0;
                                const measuredValue = (svc.total_price || 0) * (pct / 100);
                                const prevAccPct = getPreviousAccumulatedPct(svc.id);
                                const prevAccValue = (svc.total_price || 0) * (prevAccPct / 100);
                                const accPct = getAccumulatedPct(svc.id);
                                const accValue = (svc.total_price || 0) * (accPct / 100);
                                const saldoSvc = (svc.total_price || 0) - accValue;
                                const measuredAt = mi?.measured_at ? new Date(mi.measured_at).toLocaleDateString("pt-BR") : "—";
                                const isEditable = activeMed?.status === "aberta" && mi;
                                return (
                                  <div key={svc.id} className={`border border-border rounded-lg p-3 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <span className="text-sm font-medium text-foreground">{svc.description}</span>
                                        <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                                          <span>Qtd: {svc.quantity ?? 0} {svc.unit}</span>
                                          <span>Unit: {fmt(svc.unit_price)}</span>
                                          <span>Total: {fmt(svc.total_price)}</span>
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Lançamento: {measuredAt}</span>
                                    </div>
                                    <div className="grid grid-cols-6 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Med. Anterior</label>
                                        <span className="text-sm tabular-nums text-muted-foreground">{prevAccPct.toFixed(2)}% — {fmt(prevAccValue)}</span>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">% Esta Medição</label>
                                        {isEditable ? (
                                          <input
                                            type="number" min="0" max="100" step="0.01"
                                            defaultValue={pct}
                                            key={`pct-${mi.id}-${pct}`}
                                            onBlur={(e) => updateMeasuredField(mi.id, svc.id, "pct", parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground tabular-nums"
                                          />
                                        ) : (
                                          <span className="text-sm tabular-nums text-foreground">{pct.toFixed(2)}%</span>
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Valor Esta Med.</label>
                                        {isEditable ? (
                                          <input
                                            type="number" min="0" step="0.01"
                                            defaultValue={measuredValue.toFixed(2)}
                                            key={`val-${mi.id}-${measuredValue.toFixed(2)}`}
                                            onBlur={(e) => updateMeasuredField(mi.id, svc.id, "value", parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm rounded border border-input bg-background text-foreground tabular-nums"
                                          />
                                        ) : (
                                          <span className="text-sm tabular-nums text-foreground">{fmt(measuredValue)}</span>
                                        )}
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Acumulado</label>
                                        <span className="text-sm tabular-nums font-medium text-primary">{accPct.toFixed(2)}% — {fmt(accValue)}</span>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Saldo Restante</label>
                                        <span className={`text-sm tabular-nums font-medium ${saldoSvc > 0 ? "text-foreground" : saldoSvc === 0 ? "text-green-600" : "text-destructive"}`}>{fmt(saldoSvc)}</span>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Progresso</label>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(accPct, 100)}%` }} />
                                          </div>
                                          <span className="text-xs font-medium text-foreground tabular-nums">{accPct.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const totalOrcado = serviceItemsMed.reduce((s, svc) => s + (svc.total_price || 0), 0);
                      const totalMedidoAcc = serviceItemsMed.reduce((sum, svc) => {
                        const accPct = getAccumulatedPct(svc.id);
                        return sum + (svc.total_price || 0) * (accPct / 100);
                      }, 0);
                      const totalMedidoEsta = serviceItemsMed.reduce((sum, svc) => {
                        const mi = measurementItems.find((m: any) => m.budget_item_id === svc.id) as any;
                        return sum + (svc.total_price || 0) * ((mi?.measured_percentage || 0) / 100);
                      }, 0);
                      const totalSaldo = totalOrcado - totalMedidoAcc;
                      const progressPct = totalOrcado > 0 ? Math.min((totalMedidoAcc / totalOrcado) * 100, 100) : 0;
                      return (
                        <div className="space-y-3">
                          {/* Progress bar */}
                          <div className="bg-muted/50 rounded-lg border border-border px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground">Progresso da Obra</span>
                              <span className="text-sm font-bold text-primary">{progressPct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-4 bg-muted rounded-full overflow-hidden border border-border">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${progressPct}%`,
                                  background: progressPct >= 100
                                    ? 'hsl(var(--chart-2))'
                                    : progressPct >= 50
                                      ? 'hsl(var(--primary))'
                                      : 'hsl(var(--chart-4))',
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                              <span>Valor da Obra: <strong className="text-foreground">{fmt(totalOrcado)}</strong></span>
                              <span>Medido: <strong className="text-primary">{fmt(totalMedidoAcc)}</strong></span>
                              <span>Saldo Restante: <strong className={totalSaldo > 0 ? "text-foreground" : totalSaldo === 0 ? "text-green-600" : "text-destructive"}>{fmt(totalSaldo)}</strong></span>
                            </div>
                          </div>
                          {/* Totals grid */}
                          <div className="bg-muted/50 rounded-lg border border-border px-4 py-3 grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Orçado: </span>
                              <span className="font-bold text-foreground">{fmt(totalOrcado)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Esta Medição: </span>
                              <span className="font-bold text-foreground">{fmt(totalMedidoEsta)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Acumulado: </span>
                              <span className="font-bold text-primary">{fmt(totalMedidoAcc)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Saldo Restante: </span>
                              <span className={`font-bold ${totalSaldo > 0 ? "text-foreground" : totalSaldo === 0 ? "text-green-600" : "text-destructive"}`}>{fmt(totalSaldo)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "previsto_realizado" && (() => {
            const getPrefixPR = (desc: string) => {
              const m = desc.trim().match(/^(\d+(?:\.\d+)*)/);
              return m ? m[1] : null;
            };
            const phaseItemsPR = items.filter((i) => (i.category || "").toLowerCase() === "fase");
            const serviceItemsPR = items.filter((i) => ["serviço", "servico"].includes((i.category || "").toLowerCase()));
            const rootPhasesPR = phaseItemsPR.filter((p) => {
              const pfx = getPrefixPR(p.description);
              return pfx && !pfx.includes(".");
            });

            // Per-phase data (with planning)
            const phaseChartData = rootPhasesPR.map((phase) => {
              const rootIdx = getPrefixPR(phase.description)!;
              const children = serviceItemsPR.filter((s) => {
                const sp = getPrefixPR(s.description);
                return sp ? sp.split(".")[0] === rootIdx : false;
              });
              const previsto = children.reduce((sum, s) => sum + (s.total_price || 0), 0);
              const realizado = children.reduce((sum, s) => {
                const accPct = (allMeasurementItems as any[])
                  .filter((mi: any) => mi.budget_item_id === s.id)
                  .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
                return sum + (s.total_price || 0) * (accPct / 100);
              }, 0);
              // Planejado: sum of planned percentages for children across all periods
              const planejado = children.reduce((sum, s) => {
                const accPlanPct = planItems
                  .filter((pi: any) => pi.budget_item_id === s.id)
                  .reduce((a: number, pi: any) => a + (pi.planned_percentage || 0), 0);
                return sum + (s.total_price || 0) * (accPlanPct / 100);
              }, 0);
              return {
                name: phase.description.replace(/^\d+(\.\d+)*\s*[-–.]?\s*/, "").substring(0, 20),
                Previsto: Math.round(previsto * 100) / 100,
                Planejado: Math.round(planejado * 100) / 100,
                Realizado: Math.round(realizado * 100) / 100,
              };
            }).filter(d => d.Previsto > 0);

            // Build planning timeline from plan periods
            const sortedPlanPeriods = [...planPeriods].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            let cumPlan = 0;
            const planTimelineMap: Record<string, number> = {};
            sortedPlanPeriods.forEach((period: any) => {
              const periodPlanItems = planItems.filter((pi: any) => pi.plan_period_id === period.id);
              const periodValue = periodPlanItems.reduce((sum: number, pi: any) => {
                const svc = serviceItemsPR.find(s => s.id === pi.budget_item_id);
                return sum + ((svc?.total_price || 0) * ((pi.planned_percentage || 0) / 100));
              }, 0);
              cumPlan += periodValue;
              const label = period.period_label || new Date(period.period_date).toLocaleDateString("pt-BR");
              planTimelineMap[label] = Math.round(cumPlan * 100) / 100;
            });

            // Per-measurement (timeline) data
            const sortedMeasurements = [...measurements].sort((a: any, b: any) => a.measurement_number - b.measurement_number);
            let cumulativeValue = 0;
            const totalOrçado = Math.round(serviceItemsPR.reduce((s, svc) => s + (svc.total_price || 0), 0) * 100) / 100;

            // Merge plan periods and measurements into unified timeline
            const allTimelineLabels: string[] = [];
            const planLabels = sortedPlanPeriods.map((p: any) => p.period_label || new Date(p.period_date).toLocaleDateString("pt-BR"));
            const medLabels = sortedMeasurements.map((m: any) => m.reference_period || `#${m.measurement_number}`);
            // Use plan labels as base if available, otherwise measurement labels
            if (planLabels.length > 0) {
              planLabels.forEach(l => { if (!allTimelineLabels.includes(l)) allTimelineLabels.push(l); });
              medLabels.forEach(l => { if (!allTimelineLabels.includes(l)) allTimelineLabels.push(l); });
            } else {
              medLabels.forEach(l => { if (!allTimelineLabels.includes(l)) allTimelineLabels.push(l); });
            }

            // Build measurement cumulative map
            let cumReal = 0;
            const realTimelineMap: Record<string, number> = {};
            sortedMeasurements.forEach((med: any) => {
              const medItems = (allMeasurementItems as any[]).filter((mi: any) => mi.measurement_id === med.id);
              const medValue = medItems.reduce((sum: number, mi: any) => {
                const svc = serviceItemsPR.find(s => s.id === mi.budget_item_id);
                return sum + ((svc?.total_price || 0) * ((mi.measured_percentage || 0) / 100));
              }, 0);
              cumReal += medValue;
              const label = med.reference_period || `#${med.measurement_number}`;
              realTimelineMap[label] = Math.round(cumReal * 100) / 100;
            });

            let lastPlan = 0;
            let lastReal = 0;
            const timelineData = allTimelineLabels.map((label) => {
              if (planTimelineMap[label] !== undefined) lastPlan = planTimelineMap[label];
              if (realTimelineMap[label] !== undefined) lastReal = realTimelineMap[label];
              return {
                name: label,
                Orçado: totalOrçado,
                Planejado: lastPlan || undefined,
                Realizado: lastReal || undefined,
              };
            });

            // Totals
            const totalPrevisto = serviceItemsPR.reduce((s, svc) => s + (svc.total_price || 0), 0);
            const totalRealizado = serviceItemsPR.reduce((sum, svc) => {
              const accPct = (allMeasurementItems as any[])
                .filter((mi: any) => mi.budget_item_id === svc.id)
                .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
              return sum + (svc.total_price || 0) * (accPct / 100);
            }, 0);
            const desvio = totalRealizado - totalPrevisto;
            const devPct = totalPrevisto > 0 ? (totalRealizado / totalPrevisto) * 100 : 0;

            return (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Previsto x Realizado</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Comparativo entre os valores orçados e os valores efetivamente medidos em obra.</p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-xl border border-border p-4 text-center" style={{ background: "linear-gradient(135deg, hsl(220 70% 96%), hsl(220 60% 92%))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#3b82f6" }}>💰 Previsto (Orçado)</div>
                    <div className="text-xl font-extrabold mt-1.5" style={{ color: "#1e40af" }}>{fmt(totalPrevisto)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Valor total orçado para a obra</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-center" style={{ background: "linear-gradient(135deg, hsl(150 60% 95%), hsl(150 50% 90%))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#16a34a" }}>📊 Realizado (Medido)</div>
                    <div className="text-xl font-extrabold mt-1.5" style={{ color: "#15803d" }}>{fmt(totalRealizado)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Valor acumulado das medições</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-center" style={{ background: desvio > 0 ? "linear-gradient(135deg, hsl(0 60% 96%), hsl(0 50% 92%))" : "linear-gradient(135deg, hsl(160 60% 95%), hsl(160 50% 90%))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: desvio > 0 ? "#dc2626" : "#059669" }}>📈 Desvio</div>
                    <div className="text-xl font-extrabold mt-1.5" style={{ color: desvio > 0 ? "#b91c1c" : "#047857" }}>
                      {desvio > 0 ? "+" : ""}{fmt(desvio)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{desvio > 0 ? "Acima do orçado" : desvio < 0 ? "Economia" : "Dentro do orçamento"}</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-center" style={{ background: "linear-gradient(135deg, hsl(270 60% 96%), hsl(270 50% 92%))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7c3aed" }}>🎯 % Execução</div>
                    <div className="text-xl font-extrabold mt-1.5" style={{ color: devPct > 100 ? "#dc2626" : "#6d28d9" }}>
                      {devPct.toFixed(1)}%
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Percentual executado do total</p>
                  </div>
                </div>

                {phaseChartData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-muted/10">
                    <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">Sem dados para exibir. Cadastre itens e lance medições.</p>
                  </div>
                ) : (
                  <>
                    {/* Bar chart */}
                    <div className="border border-border rounded-xl p-5 bg-background shadow-sm">
                      <div className="mb-4">
                        <h5 className="text-sm font-bold text-foreground">Orçado x Planejado x Realizado por Fase</h5>
                        <p className="text-xs text-muted-foreground mt-0.5">Azul = orçado. Laranja = planejado (do planejamento físico). Verde = medido acumulado.</p>
                      </div>
                      <div style={{ width: "100%", height: 340 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={phaseChartData} margin={{ top: 10, right: 30, bottom: 40, left: 30 }} barGap={4}>
                            <defs>
                              <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                              </linearGradient>
                              <linearGradient id="gradPlanejado" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                              </linearGradient>
                              <linearGradient id="gradRealizado" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-15} textAnchor="end" />
                            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: any) => `R$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                              formatter={(value: any, name: any) => [fmt(value), name === "Previsto" ? "💰 Orçado" : name === "Planejado" ? "📋 Planejado" : "📊 Realizado"]}
                              contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                              labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(value: any) => value === "Previsto" ? "💰 Orçado" : value === "Planejado" ? "📋 Planejado" : "📊 Realizado"} />
                            <Bar dataKey="Previsto" fill="url(#gradPrevisto)" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="Planejado" fill="url(#gradPlanejado)" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="Realizado" fill="url(#gradRealizado)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Line chart */}
                    {timelineData.length > 0 && (
                      <div className="border border-border rounded-xl p-5 bg-background shadow-sm">
                        <div className="mb-4">
                          <h5 className="text-sm font-bold text-foreground">Evolução Acumulada por Período</h5>
                          <p className="text-xs text-muted-foreground mt-0.5">Tracejada azul = meta orçada. Laranja = planejado (previsão do planejamento físico). Verde = medido acumulado.</p>
                        </div>
                        <div style={{ width: "100%", height: 320 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: any) => `R$${(v / 1000).toFixed(0)}k`} />
                              <Tooltip
                                formatter={(value: any, name: any) => [fmt(value), name === "Orçado" ? "💰 Meta (Orçado)" : name === "Planejado" ? "📋 Planejado" : "📊 Acumulado (Medido)"]}
                                contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                                labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                              />
                              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(value: any) => value === "Orçado" ? "💰 Meta (Orçado)" : value === "Planejado" ? "📋 Planejado" : "📊 Acumulado (Medido)"} />
                              <Line type="monotone" dataKey="Orçado" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="8 4" dot={false} />
                              <Line type="monotone" dataKey="Planejado" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }} />
                              <Line type="monotone" dataKey="Realizado" stroke="#22c55e" strokeWidth={3} dot={{ r: 5, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Detail table */}
                    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-muted/60 px-4 py-3 border-b border-border">
                        <h5 className="text-sm font-bold text-foreground">Detalhamento por Fase</h5>
                        <p className="text-xs text-muted-foreground mt-0.5">Valores individuais por fase com desvio e barra de progresso.</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Fase</th>
                            <th className="text-right px-4 py-3 font-semibold" style={{ color: "#3b82f6" }}>💰 Orçado</th>
                            <th className="text-right px-4 py-3 font-semibold" style={{ color: "#d97706" }}>📋 Planejado</th>
                            <th className="text-right px-4 py-3 font-semibold" style={{ color: "#16a34a" }}>📊 Realizado</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">📈 Desvio</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">🎯 Execução</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground" style={{ minWidth: 120 }}>Progresso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {phaseChartData.map((d, idx) => {
                            const dev = d.Realizado - d.Previsto;
                            const pct = d.Previsto > 0 ? (d.Realizado / d.Previsto) * 100 : 0;
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                                <td className="px-4 py-2.5 text-foreground font-medium">{d.name}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "#1d4ed8" }}>{fmt(d.Previsto)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "#d97706" }}>{fmt(d.Planejado)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: "#16a34a" }}>{fmt(d.Realizado)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: dev > 0 ? "#dc2626" : dev < 0 ? "#059669" : undefined }}>
                                  {dev > 0 ? "+" : ""}{fmt(dev)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: pct > 100 ? "#dc2626" : "#7c3aed" }}>{pct.toFixed(1)}%</td>
                                <td className="px-4 py-2.5">
                                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? "#dc2626" : pct >= 50 ? "#22c55e" : "#3b82f6" }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {(() => {
                            const totalPlanejado = phaseChartData.reduce((s, d) => s + d.Planejado, 0);
                            return (
                              <tr className="bg-muted/40 font-bold">
                                <td className="px-4 py-3 text-foreground">TOTAL</td>
                                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#1d4ed8" }}>{fmt(totalPrevisto)}</td>
                                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#d97706" }}>{fmt(totalPlanejado)}</td>
                                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#16a34a" }}>{fmt(totalRealizado)}</td>
                                <td className="px-4 py-3 text-right tabular-nums" style={{ color: desvio > 0 ? "#dc2626" : "#059669" }}>{desvio > 0 ? "+" : ""}{fmt(desvio)}</td>
                                <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#7c3aed" }}>{devPct.toFixed(1)}%</td>
                                <td className="px-4 py-3">
                                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(devPct, 100)}%`, background: devPct > 100 ? "#dc2626" : "#22c55e" }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted rounded-b-xl">
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-sm font-medium ${statusColor[budget.status] || "text-muted-foreground"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${budget.status === "aprovado" ? "bg-green-500" : budget.status === "rejeitado" ? "bg-destructive" : "bg-muted-foreground"}`} />
              {statusOptions.find((s) => s.value === budget.status)?.label || budget.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DropdownButton
              label="Relatórios"
              icon={FileText}
              items={RELATORIOS}
              onSelect={async (item) => {
                try {
                  toast.info(`Gerando "${item}"...`);
                  // Fetch all measurement items across all measurements
                  const allMeasIds = measurements.map((m: any) => m.id);
                  let allMI: any[] = [];
                  if (allMeasIds.length > 0) {
                    const { data: miData } = await supabase
                      .from("budget_measurement_items")
                      .select("*")
                      .in("measurement_id", allMeasIds);
                    allMI = miData || [];
                  }
                  await generateBudgetReport(item, {
                    budget,
                    items,
                    obra,
                    client,
                    company,
                    measurements: measurements as any[],
                    allMeasurementItems: allMI,
                    planPeriods: planPeriods as any[],
                    planItems: planItems as any[],
                    userId: user!.id,
                  });
                  toast.success(`Relatório "${item}" gerado com sucesso!`);
                } catch (err: any) {
                  toast.error(`Erro: ${err?.message || "Falha ao gerar relatório"}`);
                }
              }}
            />
            <DropdownButton
              label="Ações"
              icon={Settings}
              items={ACOES}
              onSelect={(item) => {
                if (item === "Importar orçamento") {
                  setShowImport(true);
                } else {
                  toast.info(`Ação "${item}" será implementada em breve.`);
                }
              }}
            />
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm">
              Fechar
            </button>
            <button
              onClick={() => saveBudget.mutate()}
              disabled={saveBudget.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {saveBudget.isPending ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>

        {/* Item form modal */}
        {addingItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={closeItemForm}>
            <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border bg-muted rounded-t-xl">
                <h3 className="text-lg font-semibold text-primary">{editingItem ? "Editar" : "Novo"} Item</h3>
                <button onClick={closeItemForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); saveItem.mutate(); }} className="p-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Fase da obra</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedItemPhase(val);
                      setItemForm((p) => ({ ...p, category: val }));
                    }}
                    className={inputClass}
                  >
                    <option value="">Selecione a fase...</option>
                    {obraPhases.map((phase) => (
                      <option key={phase} value={phase}>{phase}</option>
                    ))}
                  </select>
                  {obraPhases.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Nenhuma fase cadastrada no Dia a dia desta obra. Você pode digitar manualmente abaixo.</p>
                  )}
                  {obraPhases.length === 0 && (
                    <input
                      value={itemForm.category}
                      onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))}
                      className={inputClass + " mt-1"}
                      placeholder="Digite a fase manualmente..."
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Serviço</label>
                  <select
                    value={itemForm.description}
                    onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Selecione o serviço...</option>
                    {obraServices.map((svc) => (
                      <option key={svc} value={svc}>{svc}</option>
                    ))}
                  </select>
                  {obraServices.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Nenhum serviço cadastrado para esta fase.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Descrição *</label>
                  <input value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} required className={inputClass} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Qtd</label>
                    <input type="number" step="0.01" value={itemForm.quantity} onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Unidade</label>
                    <input value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Preço Unit.</label>
                    <input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm((p) => ({ ...p, unit_price: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeItemForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
                  <button type="submit" disabled={saveItem.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                    {saveItem.isPending ? "Salvando..." : "💾 Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import modal */}
        {showImport && (
          <BudgetImportModal budgetId={budgetId} onClose={() => setShowImport(false)} />
        )}
      </div>
    </div>
  );
}
