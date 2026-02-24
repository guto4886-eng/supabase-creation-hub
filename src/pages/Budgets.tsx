import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, X, Download, Search, Eraser } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";
import BudgetDetail from "@/components/BudgetDetail";

interface Budget {
  id: string;
  name: string;
  status: string;
  total_value: number | null;
  description: string | null;
  obra_id: string;
  created_at: string;
  budget_code: string | null;
  company_id: string | null;
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
  const [filterCompany, setFilterCompany] = useState("");
  const [searched, setSearched] = useState(false);

  // New budget wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCompany, setWizardCompany] = useState("");
  const [wizardObra, setWizardObra] = useState("");
  const [wizardContent, setWizardContent] = useState<"blank" | "copy">("blank");
  const [wizardCopyFrom, setWizardCopyFrom] = useState("");


  // Detail modal
  const [detailBudgetId, setDetailBudgetId] = useState<string | null>(null);

  // Item form
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ description: "", category: "", quantity: "1", unit: "un", unit_price: "0" });

  const { data: companiesList = [] } = useCompanies();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(26);

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
      const { data, error } = await supabase.from("obras").select("id, name, client_id").order("name");
      if (error) throw error;
      return data as { id: string; name: string; client_id: string | null }[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: allMeasurements = [] } = useQuery({
    queryKey: ["budget_measurements_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_measurements").select("id, budget_id, status");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allMeasurementItems = [] } = useQuery({
    queryKey: ["budget_measurement_items_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_measurement_items").select("id, measurement_id, budget_item_id, measured_percentage");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = searched
    ? budgets.filter((b) => {
        if (filterName && !b.name.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterStatus && b.status !== filterStatus) return false;
        if (filterObra && b.obra_id !== filterObra) return false;
        if (filterCompany && b.company_id !== filterCompany) return false;
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

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("budgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Orçamento removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewBudget = () => { setWizardCompany(""); setWizardObra(""); setWizardContent("blank"); setWizardCopyFrom(""); setWizardOpen(true); };
  const openEditBudget = (b: Budget) => { setDetailBudgetId(b.id); };

  // Item CRUD
  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = { description: itemForm.description, category: itemForm.category || null, quantity: parseFloat(itemForm.quantity) || 1, unit: itemForm.unit || "un", unit_price: parseFloat(itemForm.unit_price) || 0 };
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
  const fmt = (v: number | null) => (v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00");
  const getObraName = (id: string) => obras.find((o) => o.id === id)?.name ?? "—";
  const getClientName = (obraId: string) => {
    const obra = obras.find((o) => o.id === obraId);
    if (!obra?.client_id) return "—";
    return clients.find((c) => c.id === obra.client_id)?.name ?? "—";
  };
  const getCompanyName = (id: string | null) => {
    if (!id) return "—";
    return companiesList.find((c) => c.id === id)?.name ?? "—";
  };

  // Compute measurement values per budget
  const getBudgetMeasurement = (budgetId: string) => {
    const budgetItems = allItems.filter((i) => i.budget_id === budgetId);
    const budgetMeasIds = allMeasurements.filter((m: any) => m.budget_id === budgetId).map((m: any) => m.id);
    const relevantMIs = allMeasurementItems.filter((mi: any) => budgetMeasIds.includes(mi.measurement_id));

    // Custo total (sum of service items total_price)
    const serviceItems = budgetItems.filter(i => ["serviço", "servico"].includes((i.category || "").toLowerCase()));
    const custoTotal = serviceItems.reduce((s, i) => s + (i.total_price || 0), 0);

    // Medido: accumulated measured percentage * total_price
    let medidoTotal = 0;
    serviceItems.forEach(svc => {
      const accPct = relevantMIs
        .filter((mi: any) => mi.budget_item_id === svc.id)
        .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
      medidoTotal += (svc.total_price || 0) * (accPct / 100);
    });

    const aMedir = custoTotal - medidoTotal;
    // Medição type: check if tracking_method exists in budget items or use "Custo" as default
    const medicaoType = custoTotal > 0 && medidoTotal > 0 ? "Venda ..." : "Custo";

    return { custoTotal, medidoTotal, aMedir: aMedir > 0 ? aMedir : 0, medicaoType };
  };

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
  const handleClearFilters = () => { setFilterName(""); setFilterStatus(""); setFilterObra(""); setFilterCompany(""); setSearched(false); };

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
              <CompanyFilterSelect value={filterCompany} onChange={setFilterCompany} companies={companiesList} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
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
          <div className="flex-1 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum orçamento encontrado.</div>
            ) : (() => {
              const totalPages = Math.ceil(filtered.length / perPage);
              const paginated = filtered.slice((page - 1) * perPage, page * perPage);
              return (
                <>
                  <div className="flex-1 overflow-auto mt-12">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-amber-700 text-white">
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Empresa</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Núm.</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Tipo</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Reg. vinc.</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Cliente</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Obra</th>
                          <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Custo (R$)</th>
                          <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Venda+taxas (R$)</th>
                          <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Medição</th>
                          <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Medido (R$)</th>
                          <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">A medir (R$)</th>
                          <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((budget, idx) => {
                          const meas = getBudgetMeasurement(budget.id);
                          return (
                            <tr
                              key={budget.id}
                              className={`border-b border-border cursor-pointer hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                              onClick={() => openEditBudget(budget)}
                            >
                              <td className="px-3 py-2 text-foreground truncate max-w-[130px]" title={getCompanyName(budget.company_id)}>{getCompanyName(budget.company_id)}</td>
                              <td className="px-3 py-2 text-foreground">{budget.budget_code || "—"}</td>
                              <td className="px-3 py-2 text-foreground">Orçamento</td>
                              <td className="px-3 py-2 text-muted-foreground"></td>
                              <td className="px-3 py-2 text-foreground truncate max-w-[140px]" title={getClientName(budget.obra_id)}>{getClientName(budget.obra_id)}</td>
                              <td className="px-3 py-2 text-foreground truncate max-w-[160px]" title={getObraName(budget.obra_id)}>{getObraName(budget.obra_id)}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt(meas.custoTotal || budget.total_value)}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt(meas.custoTotal || budget.total_value)}</td>
                              <td className="px-3 py-2 text-foreground">{meas.medidoTotal > 0 ? "Venda ..." : "Custo"}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt(meas.medidoTotal)}</td>
                              <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt(meas.aMedir)}</td>
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => openEditBudget(budget)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => { if (confirm("Remover orçamento e todos os itens?")) deleteBudget.mutate(budget.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <button onClick={openNewBudget} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-semibold hover:opacity-90">
                        <Plus className="h-3.5 w-3.5" /> Novo
                      </button>
                      <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded text-xs hover:bg-muted transition-colors">
                        <Download className="h-3.5 w-3.5" /> Exportar
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(1)} disabled={page <= 1} className="px-1.5 py-1 rounded border border-border hover:bg-muted disabled:opacity-30" title="Primeira">|&lt;</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-1.5 py-1 rounded border border-border hover:bg-muted disabled:opacity-30" title="Anterior">&lt;</button>
                        <span className="px-2 py-1 rounded border border-border bg-background text-foreground font-medium min-w-[28px] text-center">{page}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-1.5 py-1 rounded border border-border hover:bg-muted disabled:opacity-30" title="Próxima">&gt;</button>
                        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-1.5 py-1 rounded border border-border hover:bg-muted disabled:opacity-30" title="Última">&gt;|</button>
                      </div>
                      <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded border border-border bg-background text-foreground text-xs">
                        <option value={10}>10/pág.</option>
                        <option value={26}>26/pág.</option>
                        <option value={50}>50/pág.</option>
                        <option value={100}>100/pág.</option>
                      </select>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Wizard modal - New budget */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setWizardOpen(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-primary">Novo orçamento</h3>
              <button onClick={() => setWizardOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Empresa *</label>
                <select value={wizardCompany} onChange={(e) => setWizardCompany(e.target.value)} required className={inputClass}>
                  <option value="">Selecione...</option>
                  {companiesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_type === "filial" ? "↳ " : ""}{c.name}
                      {c.company_type === "matriz" ? " (Matriz)" : " (Filial)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Obra *</label>
                <select value={wizardObra} onChange={(e) => setWizardObra(e.target.value)} required className={inputClass}>
                  <option value="">Selecione...</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Conteúdo</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                    <input type="radio" name="wizardContent" checked={wizardContent === "blank"} onChange={() => { setWizardContent("blank"); setWizardCopyFrom(""); }} className="accent-primary" />
                    Em branco
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                    <input type="radio" name="wizardContent" checked={wizardContent === "copy"} onChange={() => setWizardContent("copy")} className="accent-primary" />
                    Copiar de outro orçamento
                  </label>
                </div>
              </div>
              {wizardContent === "copy" && (
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Orçamento de origem *</label>
                  <select value={wizardCopyFrom} onChange={(e) => setWizardCopyFrom(e.target.value)} required className={inputClass}>
                    <option value="">Selecione...</option>
                    {budgets.map((b) => <option key={b.id} value={b.id}>{b.name} — {getObraName(b.obra_id)}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-border bg-muted rounded-b-xl">
              <button
                onClick={async () => {
                  if (!wizardCompany) { toast.error("Selecione uma empresa"); return; }
                  if (!wizardObra) { toast.error("Selecione uma obra"); return; }
                  if (wizardContent === "copy" && !wizardCopyFrom) { toast.error("Selecione o orçamento de origem"); return; }
                  try {
                    const { data: newBudget, error } = await supabase.from("budgets").insert({
                      name: "",
                      status: "rascunho",
                      description: null,
                      obra_id: wizardObra,
                      company_id: wizardCompany,
                      user_id: user!.id,
                    }).select("id").single();
                    if (error) throw error;
                    // Copy items if needed
                    if (wizardContent === "copy" && wizardCopyFrom && newBudget) {
                      const sourceItems = allItems.filter((i) => i.budget_id === wizardCopyFrom);
                      if (sourceItems.length > 0) {
                        const copies = sourceItems.map((item) => ({
                          budget_id: newBudget.id,
                          description: item.description,
                          category: item.category,
                          quantity: item.quantity,
                          unit: item.unit,
                          unit_price: item.unit_price,
                          sort_order: item.sort_order,
                        }));
                        await supabase.from("budget_items").insert(copies);
                      }
                    }
                    qc.invalidateQueries({ queryKey: ["budgets"] });
                    qc.invalidateQueries({ queryKey: ["budget_items"] });
                    setWizardOpen(false);
                    setDetailBudgetId(newBudget.id);
                    toast.success("Orçamento criado!");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 flex items-center gap-2"
              >
                💾 Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Detail Modal */}
      {detailBudgetId && (
        <BudgetDetail
          budgetId={detailBudgetId}
          onClose={() => {
            setDetailBudgetId(null);
            qc.invalidateQueries({ queryKey: ["budgets"] });
            qc.invalidateQueries({ queryKey: ["budget_items"] });
          }}
        />
      )}
    </div>
  );
}
