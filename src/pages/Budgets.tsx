import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, X, Download, Search, Eraser } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";

interface Budget {
  id: string;
  name: string;
  status: string;
  total_value: number | null;
  description: string | null;
  obra_id: string;
  created_at: string;
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

const statusOptions = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
];

export default function Budgets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filter panel
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [searched, setSearched] = useState(false);

  // Budget form
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetForm, setBudgetForm] = useState({ name: "", status: "rascunho", description: "", obra_id: "" });

  // Item form
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Budget[];
    },
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["budget_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_items").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return data as BudgetItem[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const filtered = searched
    ? budgets.filter((b) => {
        if (filterName && !b.name.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterStatus && b.status !== filterStatus) return false;
        if (filterObra && b.obra_id !== filterObra) return false;
        return true;
      })
    : [];

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Budget CRUD
  const saveBudget = useMutation({
    mutationFn: async () => {
      const payload = { name: budgetForm.name, status: budgetForm.status, description: budgetForm.description || null, obra_id: budgetForm.obra_id };
      if (editingBudget) {
        const { error } = await supabase.from("budgets").update(payload).eq("id", editingBudget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success(editingBudget ? "Orçamento atualizado!" : "Orçamento criado!"); closeBudgetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("budgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Orçamento removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewBudget = () => { setEditingBudget(null); setBudgetForm({ name: "", status: "rascunho", description: "", obra_id: "" }); setBudgetFormOpen(true); };
  const openEditBudget = (b: Budget) => { setEditingBudget(b); setBudgetForm({ name: b.name, status: b.status, description: b.description ?? "", obra_id: b.obra_id ?? "" }); setBudgetFormOpen(true); };
  const closeBudgetForm = () => { setBudgetFormOpen(false); setEditingBudget(null); };

  // Item CRUD
  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = { description: itemForm.description, category: itemForm.category || null, quantity: parseFloat(itemForm.quantity) || 1, unit: itemForm.unit || "un", unit_price: parseFloat(itemForm.unit_price) || 0, total_price: (parseFloat(itemForm.quantity) || 1) * (parseFloat(itemForm.unit_price) || 0) };
      if (editingItem) { const { error } = await supabase.from("budget_items").update(payload).eq("id", editingItem.id); if (error) throw error; }
      else if (addingTo) { const { error } = await supabase.from("budget_items").insert({ ...payload, budget_id: addingTo }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget_items"] }); toast.success(editingItem ? "Item atualizado!" : "Item adicionado!"); closeItemForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("budget_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget_items"] }); toast.success("Item removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeItemForm = () => { setEditingItem(null); setAddingTo(null); setItemForm({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" }); };
  const openAddItem = (budgetId: string) => { setAddingTo(budgetId); setEditingItem(null); setItemForm({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" }); };
  const openEditItem = (item: BudgetItem) => { setEditingItem(item); setAddingTo(null); setItemForm({ description: item.description, category: item.category || "", quantity: String(item.quantity ?? 1), unit: item.unit || "un", unit_price: String(item.unit_price ?? 0) }); };

  const statusColor: Record<string, string> = { rascunho: "bg-muted text-muted-foreground", aprovado: "bg-primary/10 text-primary", rejeitado: "bg-destructive/10 text-destructive" };
  const fmt = (v: number | null) => (v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
  const getObraName = (id: string) => obras.find((o) => o.id === id)?.name ?? "—";

  const handleExport = () => {
    const rows = filtered.flatMap((b) => {
      const items = allItems.filter((i) => i.budget_id === b.id);
      if (items.length === 0) return [{ orcamento: b.name, status: b.status, item: "", categoria: "", qtd: "", unidade: "", preco_unit: "", total: fmt(b.total_value) }];
      return items.map((i) => ({ orcamento: b.name, status: b.status, item: i.description, categoria: i.category || "", qtd: String(i.quantity ?? ""), unidade: i.unit || "", preco_unit: String(i.unit_price ?? ""), total: String(i.total_price ?? "") }));
    });
    exportToCSV(rows, [
      { name: "orcamento", label: "Orçamento" }, { name: "status", label: "Status" },
      { name: "item", label: "Item" }, { name: "categoria", label: "Categoria" },
      { name: "qtd", label: "Qtd" }, { name: "unidade", label: "Unidade" },
      { name: "preco_unit", label: "Preço Unit." }, { name: "total", label: "Total" },
    ], "orcamentos");
  };

  const handleSearch = () => { setSearched(true); };
  const handleClearFilters = () => { setFilterName(""); setFilterStatus(""); setFilterObra(""); setSearched(false); };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel + Toggle */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Search className="h-5 w-5" />
                Orçamentos
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Todos</option>
                  {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                <select value={filterObra} onChange={(e) => setFilterObra(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Todas</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={handleClearFilters} className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg bg-white border border-border text-muted-foreground hover:bg-muted transition-colors" title="Limpar filtros">
                <Eraser className="h-5 w-5" />
              </button>
              <button onClick={handleSearch} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors">
                <Search className="h-4 w-4" /> Pesquisar
              </button>
            </div>
          </div>
        </div>

        {/* Toggle filter panel button */}
        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${filtersOpen ? "bg-primary" : "bg-amber-700"}`} />
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-amber-700"}`}
            title={filtersOpen ? "Fechar filtros" : "Filtros de pesquisa"}
          >
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1" style={{ writingMode: "vertical-lr" }}>
              FILTROS DE PESQUISA {filtersOpen ? "‹" : "›"}
            </span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!searched ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16 max-w-4xl px-8">
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Search className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faça sua pesquisa ao lado!</h3>
                <p className="text-sm text-muted-foreground">
                  Clique em <button onClick={() => setFiltersOpen(true)} className="text-primary font-medium hover:underline">filtros de pesquisa</button>, informe o que procura e clique em "Pesquisar".
                </p>
              </div>
              <div className="w-px h-48 bg-border" />
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Plus className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Inclua um novo orçamento!</h3>
                <p className="text-sm text-muted-foreground mb-4">Você também pode criar um novo orçamento agora.</p>
                <button onClick={openNewBudget} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
                  Incluir Novo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
                    <Download className="h-4 w-4" /> Exportar
                  </button>
                )}
                <button onClick={openNewBudget} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <Plus className="h-4 w-4" /> Novo Orçamento
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum orçamento encontrado.</div>
            ) : (
              <div className="flex-1 overflow-auto space-y-2">
                {filtered.map((budget) => {
                  const items = allItems.filter((i) => i.budget_id === budget.id);
                  const isExpanded = expanded.has(budget.id);
                  return (
                    <div key={budget.id} className="border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggle(budget.id)}>
                        <span className="text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                        <span className="font-medium text-foreground flex-1">{budget.name}</span>
                        <span className="text-xs text-muted-foreground">{getObraName(budget.obra_id)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[budget.status] || "bg-muted text-muted-foreground"}`}>
                          {statusOptions.find((s) => s.value === budget.status)?.label ?? budget.status}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{fmt(budget.total_value)}</span>
                        <span className="text-xs text-muted-foreground">{items.length} ite{items.length !== 1 ? "ns" : "m"}</span>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEditBudget(budget)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { if (confirm("Remover orçamento e todos os itens?")) deleteBudget.mutate(budget.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-border">
                          {items.length === 0 ? (
                            <div className="px-8 py-4 text-sm text-muted-foreground">Nenhum item neste orçamento</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/20">
                                  <th className="text-left px-8 py-2 font-medium text-muted-foreground">Descrição</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Categoria</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Un</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Preço Unit.</th>
                                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                                  <th className="w-20 px-3 py-2" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {items.map((item) => (
                                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-8 py-2 text-foreground">{item.description}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{item.category || "—"}</td>
                                    <td className="px-3 py-2 text-right text-foreground">{item.quantity ?? "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{item.unit || "—"}</td>
                                    <td className="px-3 py-2 text-right text-foreground">{fmt(item.unit_price)}</td>
                                    <td className="px-3 py-2 text-right font-medium text-foreground">{fmt(item.total_price)}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <button onClick={() => openEditItem(item)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { if (confirm("Remover item?")) deleteItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <div className="px-8 py-2 border-t border-border">
                            <button onClick={() => openAddItem(budget.id)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                              <Plus className="h-3.5 w-3.5" /> Adicionar item
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Budget form modal */}
      {budgetFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeBudgetForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editingBudget ? "Editar" : "Novo"} Orçamento</h3>
              <button onClick={closeBudgetForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveBudget.mutate(); }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Nome *</label>
                <input value={budgetForm.name} onChange={(e) => setBudgetForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Obra *</label>
                <select value={budgetForm.obra_id} onChange={(e) => setBudgetForm((p) => ({ ...p, obra_id: e.target.value }))} required className={inputClass}>
                  <option value="">Selecione...</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Status</label>
                <select value={budgetForm.status} onChange={(e) => setBudgetForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Descrição</label>
                <textarea value={budgetForm.description} onChange={(e) => setBudgetForm((p) => ({ ...p, description: e.target.value }))} rows={3} className={inputClass} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeBudgetForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saveBudget.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveBudget.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item form modal */}
      {(addingTo || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeItemForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editingItem ? "Editar" : "Novo"} Item</h3>
              <button onClick={closeItemForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveItem.mutate(); }} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Descrição</label>
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
                <button type="button" onClick={closeItemForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saveItem.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveItem.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
