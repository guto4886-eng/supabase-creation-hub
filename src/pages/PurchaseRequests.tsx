import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Eraser, Paperclip
} from "lucide-react";

const PAGE_SIZE = 15;

const PRIORITY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovada", label: "Aprovada" },
  { value: "rejeitada", label: "Rejeitada" },
  { value: "cotando", label: "Em cotação" },
  { value: "finalizada", label: "Finalizada" },
];

const ITEM_TYPES = [
  { value: "livre", label: "Item livre" },
  { value: "insumo", label: "Insumo" },
  { value: "servico", label: "Serviço" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface RequestItem {
  id?: string;
  item_type: string;
  item: string;
  complement: string;
  quantity: number;
  unit: string;
  unit_price: number;
  phase: string;
  service: string;
}

export default function PurchaseRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // --- Filter state ---
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterDescription, setFilterDescription] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // --- Modal state ---
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"dados" | "anexos">("dados");

  // --- Items state (in modal) ---
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [newItem, setNewItem] = useState<RequestItem>({ item_type: "livre", item: "", complement: "", quantity: 1, unit: "un", unit_price: 0, phase: "", service: "" });

  // --- Queries ---
  const { data: obras = [] } = useQuery({
    queryKey: ["obras_list_pr"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile_current"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["purchase_requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_requests")
        .select("*, obras(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // --- Filter logic ---
  const filtered = searched
    ? items.filter((item) => {
        if (filterDescription && !item.description?.toLowerCase().includes(filterDescription.toLowerCase())) return false;
        if (filterObra && item.obra_id !== filterObra) return false;
        if (filterStatus && item.status !== filterStatus) return false;
        if (filterPriority && item.priority !== filterPriority) return false;
        if (filterDateFrom && item.needed_by && item.needed_by < filterDateFrom) return false;
        if (filterDateTo && item.needed_by && item.needed_by > filterDateTo) return false;
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      let requestId: string;
      if (editing) {
        const { error } = await (supabase as any).from("purchase_requests").update({
          description: values.description,
          obra_id: values.obra_id || null,
          priority: values.priority || "normal",
          status: values.status || "pendente",
          needed_by: values.needed_by || null,
          notes: values.notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
        requestId = editing.id;
        // Delete old items and re-insert
        await (supabase as any).from("purchase_request_items").delete().eq("request_id", requestId);
      } else {
        const { data, error } = await (supabase as any).from("purchase_requests").insert({
          description: values.description,
          obra_id: values.obra_id || null,
          quantity: 1,
          unit: "un",
          priority: values.priority || "normal",
          status: values.status || "pendente",
          needed_by: values.needed_by || null,
          notes: values.notes || null,
          user_id: user!.id,
        }).select("id").single();
        if (error) throw error;
        requestId = data.id;
      }
      // Insert items
      if (requestItems.length > 0) {
        const rows = requestItems.map(it => ({
          request_id: requestId,
          item_type: it.item_type,
          item: it.item,
          complement: it.complement || null,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "un",
          unit_price: Number(it.unit_price) || 0,
          phase: it.phase || null,
          service: it.service || null,
        }));
        const { error: itemsErr } = await (supabase as any).from("purchase_request_items").insert(rows);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_requests"] });
      toast.success(editing ? "Solicitação atualizada!" : "Solicitação criada!", { duration: 3000 });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("purchase_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_requests"] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Modal helpers ---
  const openNew = () => {
    setEditing(null);
    setForm({ priority: "normal", status: "pendente", needed_by: "", description: "" });
    setRequestItems([]);
    setNewItem({ item_type: "livre", item: "", complement: "", quantity: 1, unit: "un", unit_price: 0, phase: "", service: "" });
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = async (item: any) => {
    setEditing(item);
    setForm({ ...item });
    setActiveTab("dados");
    setFormOpen(true);
    // Load items
    const { data } = await (supabase as any).from("purchase_request_items").select("*").eq("request_id", item.id).order("created_at");
    setRequestItems((data || []).map((r: any) => ({
      id: r.id, item_type: r.item_type, item: r.item, complement: r.complement || "",
      quantity: r.quantity, unit: r.unit, unit_price: r.unit_price || 0, phase: r.phase || "", service: r.service || "",
    })));
    setNewItem({ item_type: "livre", item: "", complement: "", quantity: 1, unit: "un", unit_price: 0, phase: "", service: "" });
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); setRequestItems([]); };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.obra_id) { toast.error("Obra é obrigatória"); return; }
    if (!form.needed_by) { toast.error("Data de necessidade é obrigatória"); return; }
    if (requestItems.length === 0) { toast.error("Adicione ao menos um item"); return; }
    saveMutation.mutate(form);
  };

  const addItem = () => {
    if (!newItem.item.trim()) { toast.error("Item é obrigatório"); return; }
    if (!newItem.quantity || newItem.quantity <= 0) { toast.error("Quantidade inválida"); return; }
    if (!newItem.unit.trim()) { toast.error("Unidade é obrigatória"); return; }
    setRequestItems(prev => [...prev, { ...newItem }]);
    setNewItem({ item_type: "livre", item: "", complement: "", quantity: 1, unit: "un", unit_price: 0, phase: "", service: "" });
  };

  const removeItem = (idx: number) => setRequestItems(prev => prev.filter((_, i) => i !== idx));

  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClearFilters = () => {
    setFilterDescription(""); setFilterObra(""); setFilterStatus(""); setFilterPriority(""); setFilterDateFrom(""); setFilterDateTo(""); setSearched(false); setPage(0);
  };

  const priorityColor = (p: string) => {
    if (p === "urgente") return "text-destructive bg-destructive/10";
    if (p === "alta") return "text-amber-600 bg-amber-100";
    if (p === "normal") return "text-primary bg-primary/10";
    return "text-muted-foreground bg-muted";
  };

  const statusColor = (s: string) => {
    if (s === "aprovada") return "text-green-600 bg-green-100";
    if (s === "rejeitada") return "text-destructive bg-destructive/10";
    if (s === "cotando") return "text-blue-600 bg-blue-100";
    if (s === "finalizada") return "text-green-700 bg-green-200";
    return "text-amber-600 bg-amber-100";
  };

  const now = new Date();

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Search className="h-5 w-5" /> Solicitações
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                <input type="text" value={filterDescription} onChange={e => setFilterDescription(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                <select value={filterObra} onChange={e => setFilterObra(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
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
                <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Necessário até</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputClass} />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={handleClearFilters} className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg bg-background border border-border text-muted-foreground hover:bg-muted transition-colors" title="Limpar filtros">
                <Eraser className="h-5 w-5" />
              </button>
              <button onClick={handleSearch} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors">
                <Search className="h-4 w-4" /> Pesquisar
              </button>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${filtersOpen ? "bg-primary" : "bg-amber-700"}`} />
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-amber-700"}`}>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ writingMode: "vertical-lr" }}>
              FILTROS DE PESQUISA {filtersOpen ? "‹" : "›"}
            </span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {!searched ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16 max-w-4xl px-8">
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Search className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faça sua pesquisa ao lado!</h3>
                <p className="text-sm text-muted-foreground">Clique em <button onClick={() => setFiltersOpen(true)} className="text-primary font-medium hover:underline">filtros de pesquisa</button> e clique em "Pesquisar".</p>
              </div>
              <div className="w-px h-48 bg-border" />
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Plus className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Nova solicitação!</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie uma nova solicitação de compra.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 uppercase tracking-wide text-sm">Nova Solicitação</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="h-4 w-4" /> Nova Solicitação
              </button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <>
                <div className="flex-1 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Obra</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground">Prioridade</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Necessário até</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Criado em</th>
                        <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`border-b border-border cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                          <td className="px-3 py-2.5 text-foreground">{item.description}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.obras?.name || "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(item.priority)}`}>{PRIORITY_OPTIONS.find(p => p.value === item.priority)?.label || item.priority}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status)}`}>{STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.needed_by ? new Date(item.needed_by + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEdit(item)} title="Editar" className="p-1.5 rounded-md hover:bg-accent text-primary"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                    <span>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-md text-sm font-medium ${i === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"}`}>{i + 1}</button>
                      )).slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3))}
                      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl flex flex-col" style={{ height: "85vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Nova"} solicitação</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/30">
              <button
                onClick={() => setActiveTab("dados")}
                className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${activeTab === "dados" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Dados
              </button>
              <button
                onClick={() => setActiveTab("anexos")}
                className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${activeTab === "anexos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Anexos
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "dados" ? (
                <div className="p-6 space-y-5">
                  {/* Info header row */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Solicitação: </span>
                      <span className="font-medium text-foreground">{editing ? editing.id.slice(0, 8).toUpperCase() : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Solicitante: </span>
                      <span className="font-medium text-foreground">{profile?.full_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dt. solicit.: </span>
                      <span className="font-medium text-foreground">
                        {editing ? new Date(editing.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>

                  {/* Situação + Prioridade */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Situação</label>
                      <select value={form.status || "pendente"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
                      <select value={form.priority || "normal"} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className={inputClass}>
                        {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Obra */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Obra *</label>
                    <select value={form.obra_id || ""} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass} required>
                      <option value="">Selecione...</option>
                      {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>

                  {/* Dt necessidade + Descrição */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Dt. necessidade *</label>
                      <input type="date" value={form.needed_by || ""} onChange={e => setForm(p => ({ ...p, needed_by: e.target.value }))} className={inputClass} required />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                      <input value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Adicionar section */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="text-sm font-semibold text-primary px-2">Adicionar</legend>

                    {/* Item type radio */}
                    <div className="flex items-center gap-6">
                      {ITEM_TYPES.map(t => (
                        <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="item_type"
                            value={t.value}
                            checked={newItem.item_type === t.value}
                            onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}
                            className="accent-primary"
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>

                    {/* Phase + Service */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Fase</label>
                        <input value={newItem.phase} onChange={e => setNewItem(p => ({ ...p, phase: e.target.value }))} className={inputClass} placeholder="Ex: Fundação" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Serviço</label>
                        <input value={newItem.service} onChange={e => setNewItem(p => ({ ...p, service: e.target.value }))} className={inputClass} placeholder="Ex: Concretagem" />
                      </div>
                    </div>

                    {/* Item + Complemento */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Item *</label>
                        <input value={newItem.item} onChange={e => setNewItem(p => ({ ...p, item: e.target.value }))} className={inputClass} required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                        <input value={newItem.complement} onChange={e => setNewItem(p => ({ ...p, complement: e.target.value }))} className={inputClass} />
                      </div>
                    </div>

                    {/* Qty + Unit + Add button */}
                    <div className="flex items-end gap-4">
                      <div className="w-32">
                        <label className="block text-sm font-medium text-foreground mb-1">Quantidade *</label>
                        <input type="number" step="0.01" min="0.01" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))} className={inputClass} />
                      </div>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-foreground mb-1">Unidade *</label>
                        <input value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="w-36">
                        <label className="block text-sm font-medium text-foreground mb-1">Valor unit. (R$)</label>
                        <input type="number" step="0.01" min="0" value={newItem.unit_price} onChange={e => setNewItem(p => ({ ...p, unit_price: Number(e.target.value) }))} className={inputClass} />
                      </div>
                      <div className="flex-1" />
                      <button type="button" onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                        <Plus className="h-4 w-4" /> Adicionar
                      </button>
                    </div>
                  </fieldset>

                  {/* Items list */}
                  <fieldset className="border border-border rounded-lg p-4">
                    <legend className="text-sm font-semibold text-muted-foreground px-2">Itens adicionados</legend>
                    {requestItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado.</p>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Tipo</th>
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Complemento</th>
                              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Qtd</th>
                              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Un</th>
                              <th className="text-right px-2 py-2 font-medium text-muted-foreground">Valor unit.</th>
                              <th className="text-right px-2 py-2 font-medium text-muted-foreground">Total</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {requestItems.map((it, idx) => (
                              <tr key={idx} className="border-b border-border">
                                <td className="px-2 py-2 text-muted-foreground capitalize">{ITEM_TYPES.find(t => t.value === it.item_type)?.label || it.item_type}</td>
                                <td className="px-2 py-2 text-foreground">{it.item}</td>
                                <td className="px-2 py-2 text-muted-foreground">{it.complement || "—"}</td>
                                <td className="px-2 py-2 text-center text-foreground">{it.quantity}</td>
                                <td className="px-2 py-2 text-center text-muted-foreground">{it.unit}</td>
                                <td className="px-2 py-2 text-right text-foreground">{(it.unit_price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                                <td className="px-2 py-2 text-right text-foreground font-medium">{((it.quantity || 0) * (it.unit_price || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                                <td className="px-2 py-2">
                                  <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </fieldset>
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center h-full">
                  <Paperclip className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Anexos estarão disponíveis após salvar a solicitação.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted rounded-b-xl">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span>Total de itens: <strong className="text-foreground">{requestItems.length}</strong></span>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
                <button type="button" onClick={() => handleSubmit()} disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? "Salvando..." : "💾 Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
