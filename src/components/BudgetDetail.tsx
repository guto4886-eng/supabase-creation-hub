import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Pencil, Trash2, FileText, ChevronDown, Settings, Upload } from "lucide-react";
import BudgetImportModal from "./BudgetImportModal";

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
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados");
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });
  const [showImport, setShowImport] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  // Fetch budget
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
    setItemForm({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });
  };
  const openEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setAddingItem(true);
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
            const serviceItems = items
              .filter((i) => (i.category || "").toLowerCase() === "serviço" || (i.category || "").toLowerCase() === "servico")
              .filter((i) => (i.total_price || 0) > 0);
            const sorted = [...serviceItems].sort((a, b) => (b.total_price || 0) - (a.total_price || 0));
            const grandTotal = sorted.reduce((s, i) => s + (i.total_price || 0), 0);
            let cumulative = 0;

            return (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Curva ABC de Serviços</h4>
                {sorted.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Nenhum serviço com valor cadastrado.</div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Classe</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Descrição</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Valor</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">% Individual</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">% Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sorted.map((item, idx) => {
                          const pct = grandTotal > 0 ? ((item.total_price || 0) / grandTotal) * 100 : 0;
                          cumulative += pct;
                          const cls = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
                          const clsColor = cls === "A" ? "text-red-600 font-bold" : cls === "B" ? "text-amber-600 font-semibold" : "text-muted-foreground";
                          return (
                            <tr key={item.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                              <td className={`px-3 py-2 ${clsColor}`}>{cls}</td>
                              <td className="px-3 py-2 text-foreground">{item.description}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt(item.total_price)}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{pct.toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{cumulative.toFixed(2)}%</td>
                            </tr>
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

          {activeTab === "planejamento" && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Planejamento Físico/Econômico</h4>
              <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">Módulo de planejamento físico/econômico em desenvolvimento.</p>
                <p className="text-xs mt-1">Aqui será possível planejar a distribuição de custos ao longo do tempo.</p>
              </div>
            </div>
          )}

          {activeTab === "medicao" && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Medição Física</h4>
              <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">Módulo de medição física em desenvolvimento.</p>
                <p className="text-xs mt-1">Aqui será possível registrar medições de avanço físico por serviço.</p>
              </div>
            </div>
          )}

          {activeTab === "previsto_realizado" && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Previsto x Realizado</h4>
              <div className="text-center py-16 text-muted-foreground border border-border rounded-lg bg-muted/10">
                <Settings className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">Módulo previsto x realizado em desenvolvimento.</p>
                <p className="text-xs mt-1">Aqui será possível comparar valores previstos com os realizados.</p>
              </div>
            </div>
          )}
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
              onSelect={(item) => toast.info(`Relatório "${item}" será implementado em breve.`)}
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
                  <label className="block text-sm font-medium text-card-foreground mb-1">Descrição *</label>
                  <input value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Fase da obra</label>
                  <input value={itemForm.category} onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))} className={inputClass} />
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
