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
        total_price: (parseFloat(itemForm.quantity) || 1) * (parseFloat(itemForm.unit_price) || 0),
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
            const phases = [...new Set(items.map((i) => i.category || "Geral"))];
            const activePhase = selectedPhase || phases[0] || "Geral";
            const phaseItems = items.filter((i) => (i.category || "Geral") === activePhase);
            const phaseTotal = phaseItems.reduce((s, i) => s + (i.total_price || 0), 0);

            return (
              <div className="flex gap-4 h-full">
                {/* Phase sidebar */}
                <div className="w-72 flex-shrink-0 border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Fase da obra</span>
                    <span className="text-xs font-semibold text-muted-foreground">Total (R$)</span>
                  </div>
                  <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                    {phases.map((phase) => {
                      const total = items.filter((i) => (i.category || "Geral") === phase).reduce((s, i) => s + (i.total_price || 0), 0);
                      return (
                        <button
                          key={phase}
                          onClick={() => setSelectedPhase(phase)}
                          className={`w-full text-left px-3 py-2.5 text-xs flex justify-between items-center transition-colors ${
                            activePhase === phase ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <span className="truncate pr-2">{phase}</span>
                          <span className="flex-shrink-0 font-medium">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-muted/50 px-3 py-2 border-t border-border">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>Total da obra:</span>
                      <span>{fmt(totalCusto)}</span>
                    </div>
                  </div>
                </div>

                {/* Phase items */}
                <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{activePhase}</h4>
                    <button onClick={() => { setItemForm({ description: "", category: activePhase, quantity: "1", unit: "un", unit_price: "0" }); setEditingItem(null); setAddingItem(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                      <Plus className="h-3.5 w-3.5" /> Adicionar item
                    </button>
                  </div>

                  {phaseItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Nenhum item nesta fase.</div>
                  ) : (
                    <div className="space-y-3">
                      {phaseItems.map((item) => (
                        <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{item.description}</span>
                            <div className="flex gap-1">
                              <button onClick={() => openEditItem(item)} className="p-1 rounded hover:bg-accent text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm("Remover item?")) deleteItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Quantidade</span>
                              <span className="font-medium text-foreground">{(item.quantity ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <span className="text-muted-foreground uppercase text-xs">{item.unit || "un"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Valor unitário:</span>
                              <span className="font-semibold text-foreground">{fmt(item.unit_price)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Valor total:</span>
                              <span className="font-bold text-foreground">{fmt(item.total_price)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-muted/30 border border-border rounded-lg p-3 flex justify-between">
                    <span className="text-sm font-semibold text-foreground">Total da fase:</span>
                    <span className="text-sm font-bold text-foreground">{fmt(phaseTotal)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "valores_venda" && (() => {
            const phases = [...new Set(items.map((i) => i.category || "Geral"))];
            const activePhase = selectedPhase || phases[0] || "Geral";
            const phaseItems = items.filter((i) => (i.category || "Geral") === activePhase);
            const totalVenda = items.reduce((s, i) => {
              const bdi = (i as any).bdi || 0;
              return s + (i.total_price || 0) * (1 + bdi / 100);
            }, 0);

            const updateBdi = async (itemId: string, bdiValue: number) => {
              await supabase.from("budget_items").update({ bdi: bdiValue } as any).eq("id", itemId);
              qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
            };

            return (
              <div className="flex gap-4 h-full">
                {/* Phase sidebar */}
                <div className="w-72 flex-shrink-0 border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Fase da obra</span>
                    <span className="text-xs font-semibold text-muted-foreground">Total (R$)</span>
                  </div>
                  <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                    {phases.map((phase) => {
                      const total = items.filter((i) => (i.category || "Geral") === phase).reduce((s, i) => {
                        const bdi = (i as any).bdi || 0;
                        return s + (i.total_price || 0) * (1 + bdi / 100);
                      }, 0);
                      return (
                        <button
                          key={phase}
                          onClick={() => setSelectedPhase(phase)}
                          className={`w-full text-left px-3 py-2.5 text-xs flex justify-between items-center transition-colors ${
                            activePhase === phase ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <span className="truncate pr-2">{phase}</span>
                          <span className="flex-shrink-0 font-medium">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-muted/50 px-3 py-2 border-t border-border">
                    <div className="flex justify-between text-xs font-bold text-foreground">
                      <span>Total venda:</span>
                      <span>{fmt(totalVenda)}</span>
                    </div>
                  </div>
                </div>

                {/* Phase items with BDI */}
                <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
                  <h4 className="text-sm font-semibold text-foreground">{activePhase}</h4>
                  {phaseItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Nenhum item nesta fase.</div>
                  ) : (
                    <div className="space-y-3">
                      {phaseItems.map((item) => {
                        const bdi = (item as any).bdi || 0;
                        const vendaUnit = (item.unit_price || 0) * (1 + bdi / 100);
                        const vendaTotal = (item.total_price || 0) * (1 + bdi / 100);
                        return (
                          <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                            <span className="text-sm font-semibold text-foreground">{item.description}</span>
                            <div className="flex items-center gap-6 text-sm flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Custo unit.:</span>
                                <span className="text-foreground">{fmt(item.unit_price)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Custo total:</span>
                                <span className="text-foreground">{fmt(item.total_price)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">BDI (%):</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={bdi}
                                  onBlur={(e) => updateBdi(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 rounded border border-input bg-background text-foreground text-sm text-right"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Venda unit.:</span>
                                <span className="font-semibold text-foreground">{fmt(vendaUnit)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Venda total:</span>
                                <span className="font-bold text-primary">{fmt(vendaTotal)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
