import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Eraser
} from "lucide-react";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "respondida", label: "Respondida" },
  { value: "aprovada", label: "Aprovada" },
  { value: "cancelada", label: "Cancelada" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function PurchaseQuotations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterTitle, setFilterTitle] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list_pq"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["purchase_quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_quotations")
        .select("*, suppliers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = searched
    ? items.filter((item) => {
        if (filterTitle && !item.title?.toLowerCase().includes(filterTitle.toLowerCase())) return false;
        if (filterSupplier && item.supplier_id !== filterSupplier) return false;
        if (filterStatus && item.status !== filterStatus) return false;
        if (filterDateFrom && item.created_at < filterDateFrom) return false;
        if (filterDateTo && item.created_at > filterDateTo + "T23:59:59") return false;
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("purchase_quotations").update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("purchase_quotations").insert({ ...values, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_quotations"] });
      toast.success(editing ? "Cotação atualizada!" : "Cotação criada!", { duration: 3000 });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_quotations"] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ status: "rascunho" }); setFormOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) { toast.error("Título obrigatório"); return; }
    saveMutation.mutate({
      title: form.title,
      supplier_id: form.supplier_id || null,
      description: form.description || null,
      status: form.status || "rascunho",
      deadline: form.deadline || null,
      total_value: Number(form.total_value) || 0,
      notes: form.notes || null,
    });
  };

  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClearFilters = () => { setFilterTitle(""); setFilterSupplier(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); setSearched(false); setPage(0); };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColor = (s: string) => {
    if (s === "aprovada") return "text-green-600 bg-green-100";
    if (s === "respondida") return "text-blue-600 bg-blue-100";
    if (s === "enviada") return "text-amber-600 bg-amber-100";
    if (s === "cancelada") return "text-destructive bg-destructive/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2"><Search className="h-5 w-5" /> Cotações de Compra</h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Título</label>
                <input type="text" value={filterTitle} onChange={e => setFilterTitle(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Fornecedor</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Período</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputClass} />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={handleClearFilters} className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg bg-background border border-border text-muted-foreground hover:bg-muted transition-colors"><Eraser className="h-5 w-5" /></button>
              <button onClick={handleSearch} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"><Search className="h-4 w-4" /> Pesquisar</button>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${filtersOpen ? "bg-primary" : "bg-amber-700"}`} />
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-amber-700"}`}>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ writingMode: "vertical-lr" }}>FILTROS DE PESQUISA {filtersOpen ? "‹" : "›"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!searched ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16 max-w-4xl px-8">
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Search className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faça sua pesquisa ao lado!</h3>
                <p className="text-sm text-muted-foreground">Pesquise cotações de compra existentes.</p>
              </div>
              <div className="w-px h-48 bg-border" />
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Plus className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Nova cotação!</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie uma nova cotação de compra.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 uppercase tracking-wide text-sm">Nova Cotação</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Nova Cotação</button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <div className="flex-1 overflow-auto border border-border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="sticky top-0"><tr className="bg-muted/50">
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Título</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Prazo</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Criado em</th>
                    <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">Ações</th>
                  </tr></thead>
                  <tbody>
                    {paginatedItems.map((item, idx) => (
                      <tr key={item.id} onClick={() => openEdit(item)} className={`border-b border-border cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                        <td className="px-3 py-2.5 text-foreground">{item.title}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.suppliers?.name || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-foreground">{formatCurrency(Number(item.total_value) || 0)}</td>
                        <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status)}`}>{STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}</span></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.deadline ? new Date(item.deadline + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-accent text-primary"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Nova"} cotação</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
                <input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Fornecedor</label>
                  <select value={form.supplier_id || ""} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select value={form.status || "rascunho"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Valor total</label>
                  <input type="number" step="0.01" value={form.total_value ?? 0} onChange={e => setForm(p => ({ ...p, total_value: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Prazo</label>
                  <input type="date" value={form.deadline || ""} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                <textarea value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
              </div>
            </form>
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-border bg-muted rounded-b-xl">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" onClick={handleSubmit as any} disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? "Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
