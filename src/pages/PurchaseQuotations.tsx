import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Attachments from "@/components/Attachments";
import QuotationDeliveryAddress from "@/components/quotation/QuotationDeliveryAddress";
import QuotationSuppliers from "@/components/quotation/QuotationSuppliers";
import QuotationSending from "@/components/quotation/QuotationSending";
import QuotationLinkedRecords from "@/components/quotation/QuotationLinkedRecords";
import QuotationMessages from "@/components/quotation/QuotationMessages";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Eraser, Paperclip
} from "lucide-react";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "nova_cotacao", label: "Nova cotação" },
  { value: "enviada", label: "Enviada" },
  { value: "respondida", label: "Respondida" },
  { value: "aprovada", label: "Aprovada" },
  { value: "cancelada", label: "Cancelada" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface QuotationItem {
  id?: string;
  insumo_id?: string;
  item_type: string;
  description: string;
  brand: string;
  complement: string;
  quantity: number;
  unit: string;
  unit_price: number;
  phase: string;
  service: string;
}

interface Insumo {
  id: string;
  name: string;
  unit: string;
  category: string | null;
}

export default function PurchaseQuotations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // --- Filter state ---
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterTitle, setFilterTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // --- Modal state ---
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"dados" | "endereco" | "fornecedores" | "envio" | "vinculos" | "anexos" | "mensagens">("dados");

  // --- Items state ---
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [newItem, setNewItem] = useState<QuotationItem>({
    item_type: "insumo", description: "", brand: "", complement: "",
    quantity: 1, unit: "un", unit_price: 0, phase: "", service: "",
  });

  // --- Insumo search state ---
  const [insumoSearch, setInsumoSearch] = useState("");
  const [insumoDropdownOpen, setInsumoDropdownOpen] = useState(false);
  const [addingNewInsumo, setAddingNewInsumo] = useState(false);
  const [newInsumoName, setNewInsumoName] = useState("");
  const [newInsumoUnit, setNewInsumoUnit] = useState("un");
  const [newInsumoCategory, setNewInsumoCategory] = useState("");
  const insumoRef = useRef<HTMLDivElement>(null);

  // --- Queries ---
  const { data: obras = [] } = useQuery({
    queryKey: ["obras_list_pq"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile_current_pq"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos_list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("insumos").select("id, name, unit, category").order("name");
      if (error) throw error;
      return data as Insumo[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["purchase_quotations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_quotations")
        .select("*, obras:obra_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredInsumos = insumoSearch.trim()
    ? insumos.filter((i) => i.name.toLowerCase().includes(insumoSearch.toLowerCase())).slice(0, 15)
    : insumos.slice(0, 15);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (insumoRef.current && !insumoRef.current.contains(e.target as Node)) {
        setInsumoDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // --- Filter logic ---
  const filtered = searched
    ? items.filter((item) => {
        if (filterTitle && !item.title?.toLowerCase().includes(filterTitle.toLowerCase())) return false;
        if (filterStatus && item.status !== filterStatus) return false;
        if (filterObra && item.obra_id !== filterObra) return false;
        if (filterDateFrom && item.created_at < filterDateFrom) return false;
        if (filterDateTo && item.created_at > filterDateTo + "T23:59:59") return false;
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      let quotationId: string;
      if (editing) {
        const { error } = await (supabase as any).from("purchase_quotations").update({
          title: values.title,
          description: values.description || null,
          status: values.status || "nova_cotacao",
          deadline: values.deadline || null,
          notes: values.notes || null,
          obra_id: values.obra_id || null,
          delivery_cep: values.delivery_cep || null,
          delivery_address: values.delivery_address || null,
          delivery_number: values.delivery_number || null,
          delivery_complement: values.delivery_complement || null,
          delivery_neighborhood: values.delivery_neighborhood || null,
          delivery_city: values.delivery_city || null,
          delivery_state: values.delivery_state || null,
          delivery_address_source: values.delivery_address_source || "obra",
        }).eq("id", editing.id);
        if (error) throw error;
        quotationId = editing.id;
        await (supabase as any).from("quotation_items").delete().eq("quotation_id", quotationId);
      } else {
        const { data, error } = await (supabase as any).from("purchase_quotations").insert({
          title: values.title || "Cotação",
          description: values.description || null,
          status: values.status || "nova_cotacao",
          deadline: values.deadline || null,
          notes: values.notes || null,
          obra_id: values.obra_id || null,
          delivery_cep: values.delivery_cep || null,
          delivery_address: values.delivery_address || null,
          delivery_number: values.delivery_number || null,
          delivery_complement: values.delivery_complement || null,
          delivery_neighborhood: values.delivery_neighborhood || null,
          delivery_city: values.delivery_city || null,
          delivery_state: values.delivery_state || null,
          delivery_address_source: values.delivery_address_source || "obra",
          user_id: user!.id,
        }).select("id").single();
        if (error) throw error;
        quotationId = data.id;
      }
      if (quotationItems.length > 0) {
        const rows = quotationItems.map(it => ({
          quotation_id: quotationId,
          insumo_id: it.insumo_id || null,
          item_type: it.item_type,
          description: it.description,
          brand: it.brand || null,
          complement: it.complement || null,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "un",
          unit_price: Number(it.unit_price) || 0,
          phase: it.phase || null,
          service: it.service || null,
        }));
        const { error: itemsErr } = await (supabase as any).from("quotation_items").insert(rows);
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_quotations"] });
      toast.success(editing ? "Cotação atualizada!" : "Cotação criada!", { duration: 3000 });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addInsumoMutation = useMutation({
    mutationFn: async () => {
      if (!newInsumoName.trim()) throw new Error("Nome obrigatório");
      const { data, error } = await (supabase as any).from("insumos").insert({
        name: newInsumoName.trim(),
        unit: newInsumoUnit || "un",
        category: newInsumoCategory || null,
        user_id: user!.id,
        is_default: false,
      }).select("id, name, unit, category").single();
      if (error) throw error;
      return data as Insumo;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["insumos_list"] });
      setNewItem(p => ({ ...p, insumo_id: data.id, description: data.name, unit: data.unit }));
      setInsumoSearch(data.name);
      setAddingNewInsumo(false);
      setNewInsumoName("");
      setNewInsumoUnit("un");
      setNewInsumoCategory("");
      toast.success("Insumo criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("purchase_quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_quotations"] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Modal helpers ---
  const openNew = () => {
    setEditing(null);
    setForm({ status: "nova_cotacao", description: "" });
    setQuotationItems([]);
    resetNewItem();
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = async (item: any) => {
    setEditing(item);
    setForm({ ...item });
    setActiveTab("dados");
    setFormOpen(true);
    const { data } = await (supabase as any).from("quotation_items").select("*").eq("quotation_id", item.id).order("created_at");
    setQuotationItems((data || []).map((r: any) => ({
      id: r.id, insumo_id: r.insumo_id, item_type: r.item_type, description: r.description,
      brand: r.brand || "", complement: r.complement || "", quantity: r.quantity,
      unit: r.unit, unit_price: r.unit_price || 0, phase: r.phase || "", service: r.service || "",
    })));
    resetNewItem();
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); setQuotationItems([]); };

  const resetNewItem = () => {
    setNewItem({ item_type: "insumo", description: "", brand: "", complement: "", quantity: 1, unit: "un", unit_price: 0, phase: "", service: "" });
    setInsumoSearch("");
    setInsumoDropdownOpen(false);
    setAddingNewInsumo(false);
  };

  const handleSubmit = () => {
    if (!form.obra_id) { toast.error("Obra é obrigatória"); return; }
    if (quotationItems.length === 0) { toast.error("Adicione ao menos um insumo"); return; }
    saveMutation.mutate(form);
  };

  const selectInsumo = (insumo: Insumo) => {
    setNewItem(p => ({ ...p, insumo_id: insumo.id, description: insumo.name, unit: insumo.unit }));
    setInsumoSearch(insumo.name);
    setInsumoDropdownOpen(false);
  };

  const addItem = () => {
    if (!newItem.description.trim()) { toast.error("Insumo é obrigatório"); return; }
    if (!newItem.quantity || newItem.quantity <= 0) { toast.error("Quantidade inválida"); return; }
    setQuotationItems(prev => [...prev, { ...newItem }]);
    resetNewItem();
  };

  const removeItem = (idx: number) => setQuotationItems(prev => prev.filter((_, i) => i !== idx));

  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClearFilters = () => {
    setFilterTitle(""); setFilterStatus(""); setFilterObra(""); setFilterDateFrom(""); setFilterDateTo(""); setSearched(false); setPage(0);
  };

  const statusColor = (s: string) => {
    if (s === "aprovada") return "text-green-600 bg-green-100";
    if (s === "respondida") return "text-blue-600 bg-blue-100";
    if (s === "enviada") return "text-amber-600 bg-amber-100";
    if (s === "cancelada") return "text-destructive bg-destructive/10";
    return "text-muted-foreground bg-muted";
  };

  const now = new Date();

  const TABS = [
    { key: "dados", label: "Dados" },
    { key: "endereco", label: "End. Entrega" },
    { key: "fornecedores", label: "Fornecedores" },
    { key: "envio", label: "Envio" },
    { key: "vinculos", label: "Registros Vinculados" },
    { key: "anexos", label: "Anexos" },
    { key: "mensagens", label: "Mensagens" },
  ] as const;

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2"><Search className="h-5 w-5" /> Cotações</h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Título</label>
                <input type="text" value={filterTitle} onChange={e => setFilterTitle(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Situação</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                <select value={filterObra} onChange={e => setFilterObra(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
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

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {!searched ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16 max-w-4xl px-8">
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Search className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faça sua pesquisa ao lado!</h3>
                <p className="text-sm text-muted-foreground">Pesquise cotações existentes.</p>
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
              <>
                <div className="flex-1 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0"><tr className="bg-muted/50">
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground">Título</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground">Obra</th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground">Situação</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground">Prazo</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground">Criado em</th>
                      <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">Ações</th>
                    </tr></thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`border-b border-border cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                          <td className="px-3 py-2.5 text-foreground">{item.title}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.obras?.name || "—"}</td>
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
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Nova"} cotação</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/30 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`whitespace-nowrap px-4 text-center py-3 text-sm font-medium transition-colors ${activeTab === t.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "dados" ? (
                <div className="p-6 space-y-5">
                  {/* Info header */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Cotação: </span>
                      <span className="font-medium text-foreground">{editing ? editing.id.slice(0, 8).toUpperCase() : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Responsável: </span>
                      <span className="font-medium text-foreground">{profile?.full_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Situação: </span>
                      <span className="font-medium text-foreground">{STATUS_OPTIONS.find(s => s.value === (form.status || "nova_cotacao"))?.label || "Nova cotação"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Dt. criação: </span>
                      <span className="font-medium text-foreground">{editing ? new Date(editing.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dt. alteração: </span>
                      <span className="font-medium text-foreground">{editing ? new Date(editing.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div />
                  </div>

                  {/* Obra + Descrição */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Obra *</label>
                      <select value={form.obra_id || ""} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass} required>
                        <option value="">Selecione...</option>
                        {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                      <input value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Adicionar section */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="text-sm font-semibold text-primary px-2">Adicionar</legend>

                    {/* Type radio */}
                    <div className="flex items-center gap-6">
                      {[{ value: "insumo", label: "Insumo" }, { value: "servico", label: "Serviço" }].map(t => (
                        <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="q_item_type" value={t.value}
                            checked={newItem.item_type === t.value}
                            onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}
                            className="accent-primary" />
                          {t.label}
                        </label>
                      ))}
                    </div>

                    {/* Obra + Fase + Serviço (phase context) */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Fase</label>
                        <input value={newItem.phase} onChange={e => setNewItem(p => ({ ...p, phase: e.target.value }))} className={inputClass} placeholder="Ex: Fundação" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Serviço</label>
                        <input value={newItem.service} onChange={e => setNewItem(p => ({ ...p, service: e.target.value }))} className={inputClass} placeholder="Ex: Concretagem" />
                      </div>
                      <div />
                    </div>

                    {/* Insumo search */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative" ref={insumoRef}>
                        <label className="block text-sm font-medium text-foreground mb-1">Insumo *</label>
                        <div className="flex gap-1">
                          <div className="relative flex-1">
                            <input
                              value={insumoSearch}
                              onChange={e => { setInsumoSearch(e.target.value); setInsumoDropdownOpen(true); setNewItem(p => ({ ...p, insumo_id: undefined, description: e.target.value })); }}
                              onFocus={() => setInsumoDropdownOpen(true)}
                              placeholder="Procure insumos..."
                              className={inputClass}
                            />
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                          <button type="button" onClick={() => setAddingNewInsumo(true)} className="px-2 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90" title="Novo insumo">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        {insumoDropdownOpen && filteredInsumos.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                            {filteredInsumos.map(ins => (
                              <button key={ins.id} type="button" onClick={() => selectInsumo(ins)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex justify-between">
                                <span className="text-foreground">{ins.name}</span>
                                <span className="text-muted-foreground text-xs">{ins.category} • {ins.unit}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Marca</label>
                        <input value={newItem.brand} onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                        <input value={newItem.complement} onChange={e => setNewItem(p => ({ ...p, complement: e.target.value }))} className={inputClass} />
                      </div>
                    </div>

                    {/* Qty + Unit + Add */}
                    <div className="flex items-end gap-4">
                      <div className="w-32">
                        <label className="block text-sm font-medium text-foreground mb-1">Quantidade *</label>
                        <input type="number" step="0.01" min="0.01" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))} className={inputClass} />
                      </div>
                      <div className="w-28">
                        <label className="block text-sm font-medium text-foreground mb-1">Unidade</label>
                        <input value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="flex-1" />
                      <button type="button" onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                        <Plus className="h-4 w-4" /> Adicionar
                      </button>
                    </div>
                  </fieldset>

                  {/* Items list */}
                  <fieldset className="border border-border rounded-lg p-4">
                    <legend className="text-sm font-semibold text-muted-foreground px-2">Relação de insumos ({quotationItems.length})</legend>
                    {quotationItems.length === 0 ? (
                      <p className="text-sm text-destructive py-2">Nenhum registro.</p>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Insumo</th>
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Marca</th>
                              <th className="text-left px-2 py-2 font-medium text-muted-foreground">Complemento</th>
                              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Qtd</th>
                              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Un</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {quotationItems.map((it, idx) => (
                              <tr key={idx} className="border-b border-border">
                                <td className="px-2 py-2 text-foreground">{it.description}</td>
                                <td className="px-2 py-2 text-muted-foreground">{it.brand || "—"}</td>
                                <td className="px-2 py-2 text-muted-foreground">{it.complement || "—"}</td>
                                <td className="px-2 py-2 text-center text-foreground">{it.quantity}</td>
                                <td className="px-2 py-2 text-center text-muted-foreground">{it.unit}</td>
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
              ) : activeTab === "endereco" ? (
                <QuotationDeliveryAddress form={form} setForm={setForm} obras={obras as any} />
              ) : activeTab === "fornecedores" ? (
                <QuotationSuppliers quotationId={editing?.id || null} />
              ) : activeTab === "envio" ? (
                <QuotationSending quotationId={editing?.id || null} />
              ) : activeTab === "vinculos" ? (
                <QuotationLinkedRecords quotationId={editing?.id || null} />
              ) : activeTab === "mensagens" ? (
                <QuotationMessages quotationId={editing?.id || null} />
              ) : editing ? (
                <div className="p-6">
                  <Attachments entityType="purchase_quotation" entityId={editing.id} />
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center h-full">
                  <Paperclip className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Salve a cotação primeiro para anexar arquivos.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted rounded-b-xl">
              <div className="text-sm text-muted-foreground">
                Insumos: <strong className="text-foreground">{quotationItems.length}</strong>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
                <button type="button" onClick={handleSubmit} disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? "Salvando..." : "💾 Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add new insumo modal */}
      {addingNewInsumo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setAddingNewInsumo(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary">Novo Insumo</h3>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
              <input value={newInsumoName} onChange={e => setNewInsumoName(e.target.value)} className={inputClass} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unidade</label>
                <input value={newInsumoUnit} onChange={e => setNewInsumoUnit(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <input value={newInsumoCategory} onChange={e => setNewInsumoCategory(e.target.value)} className={inputClass} placeholder="Ex: Hidráulica" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddingNewInsumo(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => addInsumoMutation.mutate()} disabled={addInsumoMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                {addInsumoMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
