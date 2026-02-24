import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Pencil, Trash2 } from "lucide-react";

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

export default function BudgetDetail({ budgetId, onClose }: BudgetDetailProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dados");
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });

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

          {activeTab === "valores_custo" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Itens de custo</h4>
                <button onClick={openAddItem} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <Plus className="h-4 w-4" /> Adicionar item
                </button>
              </div>
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum item de custo cadastrado.</div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qtd</th>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Un</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Preço Unit.</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Total</th>
                        <th className="w-20 px-3 py-2.5 text-center font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <tr key={item.id} className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                          <td className="px-3 py-2 text-foreground">{item.description}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category || "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{item.quantity ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.unit || "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">{fmt(item.total_price)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEditItem(item)} className="p-1.5 rounded-md hover:bg-accent text-primary"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { if (confirm("Remover item?")) deleteItem.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t border-border">
                        <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-foreground">Total:</td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(totalCusto)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "valores_venda" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Valores de venda</h4>
              </div>
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum item cadastrado. Adicione itens na aba "Valores custo".</div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Custo Unit.</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qtd</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Custo Total</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Venda Unit.</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Venda Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <tr key={item.id} className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                          <td className="px-3 py-2 text-foreground">{item.description}</td>
                          <td className="px-3 py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right text-foreground">{item.quantity ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground">{fmt(item.total_price)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 border-t border-border">
                        <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-foreground">Total:</td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(totalCusto)}</td>
                        <td />
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(totalCusto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

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
          <div className="flex items-center gap-3">
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
                  <label className="block text-sm font-medium text-card-foreground mb-1">Categoria</label>
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
      </div>
    </div>
  );
}
