import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, Pencil, Trash2, Eraser, DollarSign, X,
  TrendingUp, TrendingDown, AlertCircle, ChevronLeft, ChevronRight, Download,
  BarChart3, List,
} from "lucide-react";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";
import { exportToCSV } from "@/utils/exportCsv";
import FinancialDashboard from "@/components/FinancialDashboard";

const PAGE_SIZE = 15;

const TYPE_OPTIONS = [
  { value: "despesa", label: "Despesa" },
  { value: "receita", label: "Receita" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "cancelado", label: "Cancelado" },
];

const CATEGORY_OPTIONS = [
  "Material", "Mão de Obra", "Equipamento", "Serviço", "Transporte",
  "Aluguel", "Impostos", "Administrativo", "Outro",
];

const PAYMENT_METHOD_OPTIONS = [
  "Dinheiro", "PIX", "Boleto", "Cartão de Crédito", "Cartão de Débito",
  "Transferência", "Cheque", "Débito Automático", "Outro",
];

const ORIGIN_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "ordem_compra", label: "Ordem de Compra" },
  { value: "contrato", label: "Contrato" },
  { value: "recorrente", label: "Recorrente" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface FinancialDoc {
  id: string;
  description: string;
  type: string;
  value: number;
  status: string;
  due_date: string | null;
  payment_date: string | null;
  category: string | null;
  notes: string | null;
  obra_id: string | null;
  supplier_id: string | null;
  company_id: string | null;
  client_id: string | null;
  document_number: string | null;
  payment_method: string | null;
  payment_terms: string | null;
  cost_center: string | null;
  installments: number | null;
  current_installment: number | null;
  origin: string | null;
  origin_id: string | null;
  created_at: string;
  updated_at: string;
  obras?: { name: string } | null;
  suppliers?: { name: string } | null;
  companies?: { name: string } | null;
  clients?: { name: string } | null;
}

export default function Financial() {
  const [mainTab, setMainTab] = useState<"lancamentos" | "dashboard">("lancamentos");
  const { user } = useAuth();
  const qc = useQueryClient();

  // Sidebar filter states
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterDateType, setFilterDateType] = useState<"vencimento" | "pagamento" | "criacao" | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterValueFrom, setFilterValueFrom] = useState("");
  const [filterValueTo, setFilterValueTo] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialDoc | null>(null);
  const [form, setForm] = useState({
    description: "", type: "despesa", value: "0", status: "pendente",
    due_date: "", payment_date: "", category: "", notes: "", obra_id: "",
    supplier_id: "", company_id: "", client_id: "", document_number: "",
    payment_method: "", payment_terms: "", cost_center: "",
    installments: "1", current_installment: "1", origin: "manual",
  });
  const [modalTab, setModalTab] = useState("dados");

  const { data: companiesList = [] } = useCompanies();

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_fin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financial_docs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_docs")
        .select("*, obras(name), suppliers:suppliers(name), companies(name), clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinancialDoc[];
    },
  });

  // Toggle helpers
  const toggleType = (val: string) => setFilterTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const toggleStatus = (val: string) => setFilterStatuses(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  // Filtering
  const filtered = searched
    ? items.filter((item) => {
        if (filterTypes.length > 0 && !filterTypes.includes(item.type)) return false;
        if (filterStatuses.length > 0 && !filterStatuses.includes(item.status)) return false;
        if (filterCompany && item.company_id !== filterCompany) return false;
        if (filterObra && item.obra_id !== filterObra) return false;
        if (filterSupplier && item.supplier_id !== filterSupplier) return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterDescription && !item.description.toLowerCase().includes(filterDescription.toLowerCase())) return false;
        // Date
        let dateField = item.created_at?.substring(0, 10);
        if (filterDateType === "vencimento") dateField = item.due_date || "";
        else if (filterDateType === "pagamento") dateField = item.payment_date || "";
        if (filterDateFrom && dateField && dateField < filterDateFrom) return false;
        if (filterDateTo && dateField && dateField > filterDateTo) return false;
        // Value
        const val = Number(item.value) || 0;
        if (filterValueFrom && val < Number(filterValueFrom)) return false;
        if (filterValueTo && val > Number(filterValueTo)) return false;
        return true;
      })
    : [];

  // Summary
  const summary = useMemo(() => {
    const receitas = filtered.filter(i => i.type === "receita").reduce((s, i) => s + Number(i.value), 0);
    const despesas = filtered.filter(i => i.type === "despesa").reduce((s, i) => s + Number(i.value), 0);
    const pendentes = filtered.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.value), 0);
    const pagos = filtered.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.value), 0);
    return { receitas, despesas, saldo: receitas - despesas, pendentes, pagos };
  }, [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        description: form.description,
        type: form.type,
        value: parseFloat(form.value) || 0,
        status: form.status,
        due_date: form.due_date || null,
        payment_date: form.payment_date || null,
        category: form.category || null,
        notes: form.notes || null,
        obra_id: form.obra_id || null,
        supplier_id: form.supplier_id || null,
        company_id: form.company_id || null,
        client_id: form.client_id || null,
        document_number: form.document_number || null,
        payment_method: form.payment_method || null,
        payment_terms: form.payment_terms || null,
        cost_center: form.cost_center || null,
        installments: parseInt(form.installments) || 1,
        current_installment: parseInt(form.current_installment) || 1,
        origin: form.origin || "manual",
      };
      if (editing) {
        const { error } = await supabase.from("financial_docs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_docs").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_docs"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_docs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_docs"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const defaultForm = {
    description: "", type: "despesa", value: "0", status: "pendente",
    due_date: "", payment_date: "", category: "", notes: "", obra_id: "",
    supplier_id: "", company_id: "", client_id: "", document_number: "",
    payment_method: "", payment_terms: "", cost_center: "",
    installments: "1", current_installment: "1", origin: "manual",
  };

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setModalTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: FinancialDoc) => {
    setEditing(item);
    setForm({
      description: item.description,
      type: item.type,
      value: String(item.value),
      status: item.status,
      due_date: item.due_date ?? "",
      payment_date: item.payment_date ?? "",
      category: item.category ?? "",
      notes: item.notes ?? "",
      obra_id: item.obra_id ?? "",
      supplier_id: item.supplier_id ?? "",
      company_id: item.company_id ?? "",
      client_id: item.client_id ?? "",
      document_number: item.document_number ?? "",
      payment_method: item.payment_method ?? "",
      payment_terms: item.payment_terms ?? "",
      cost_center: item.cost_center ?? "",
      installments: String(item.installments ?? 1),
      current_installment: String(item.current_installment ?? 1),
      origin: item.origin ?? "manual",
    });
    setModalTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClear = () => {
    setFilterTypes([]); setFilterStatuses([]); setFilterCompany(""); setFilterObra("");
    setFilterSupplier(""); setFilterCategory(""); setFilterDescription("");
    setFilterDateType(""); setFilterDateFrom(""); setFilterDateTo("");
    setFilterValueFrom(""); setFilterValueTo(""); setSearched(false); setPage(0);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColor: Record<string, string> = {
    pendente: "text-amber-600 bg-amber-100",
    pago: "text-green-700 bg-green-200",
    cancelado: "text-destructive bg-destructive/10",
  };

  const typeColor: Record<string, string> = {
    receita: "text-emerald-600",
    despesa: "text-destructive",
  };

  const handleExport = () => {
    exportToCSV(filtered, [
      { name: "description", label: "Descrição" },
      { name: "type", label: "Tipo" },
      { name: "value", label: "Valor" },
      { name: "status", label: "Status" },
      { name: "due_date", label: "Vencimento" },
      { name: "payment_date", label: "Pagamento" },
      { name: "category", label: "Categoria" },
    ], "financeiro");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Top tab switcher */}
      <div className="flex items-center border-b border-border bg-card px-4">
        <button
          onClick={() => setMainTab("lancamentos")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${mainTab === "lancamentos" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
        >
          <List className="h-4 w-4" /> Lançamentos
        </button>
        <button
          onClick={() => setMainTab("dashboard")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${mainTab === "dashboard" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
        >
          <BarChart3 className="h-4 w-4" /> Dashboard
        </button>
      </div>

      {mainTab === "dashboard" ? (
        <FinancialDashboard />
      ) : (
      <div className="flex flex-1 overflow-hidden relative">
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-bold text-primary uppercase">Financeiro</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">ⓘ Faça sua pesquisa aqui</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <CompanyFilterSelect value={filterCompany} onChange={setFilterCompany} companies={companiesList} className={inputClass} />

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
                <div className="space-y-1.5">
                  {TYPE_OPTIONS.map(t => (
                    <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={filterTypes.includes(t.value)} onChange={() => toggleType(t.value)} className="rounded border-input accent-primary" />
                      <span className="text-foreground">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Situação</label>
                <div className="space-y-1.5">
                  {STATUS_OPTIONS.map(s => (
                    <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={filterStatuses.includes(s.value)} onChange={() => toggleStatus(s.value)} className="rounded border-input accent-primary" />
                      <span className="text-foreground">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data</label>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  {(["vencimento", "pagamento", "criacao"] as const).map(dt => (
                    <label key={dt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={filterDateType === dt} onChange={() => setFilterDateType(filterDateType === dt ? "" : dt)} className="rounded border-input accent-primary" />
                      <span className="capitalize">{dt === "criacao" ? "Criação" : dt === "vencimento" ? "Vencimento" : "Pagamento"}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputClass} />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Valor</label>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="R$" value={filterValueFrom} onChange={e => setFilterValueFrom(e.target.value)} className={inputClass} />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input type="text" placeholder="R$" value={filterValueTo} onChange={e => setFilterValueTo(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                <select value={filterObra} onChange={e => setFilterObra(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Fornecedor</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                <input type="text" value={filterDescription} onChange={e => setFilterDescription(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={handleClear} className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg bg-background border border-border text-muted-foreground hover:bg-muted transition-colors"><Eraser className="h-5 w-5" /></button>
              <button onClick={handleSearch} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-colors"><Search className="h-4 w-4" /> Pesquisar</button>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${filtersOpen ? "bg-primary" : "bg-primary/70"}`} />
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-primary/70"}`}>
            <span className="text-primary-foreground text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ writingMode: "vertical-lr" }}>FILTROS DE PESQUISA {filtersOpen ? "‹" : "›"}</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!searched ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-16 max-w-4xl px-8">
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Search className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Faça sua pesquisa ao lado!</h3>
                <p className="text-sm text-muted-foreground">Pesquise documentos financeiros existentes.</p>
              </div>
              <div className="w-px h-48 bg-border" />
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"><Plus className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Novo lançamento!</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie uma nova receita ou despesa.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 uppercase tracking-wide text-sm">Novo Lançamento</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <div><p className="text-xs text-muted-foreground">Receitas</p><p className="text-lg font-bold text-emerald-600">{fmt(summary.receitas)}</p></div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-xs text-muted-foreground">Despesas</p><p className="text-lg font-bold text-destructive">{fmt(summary.despesas)}</p></div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`text-lg font-bold ${summary.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(summary.saldo)}</p></div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-amber-600" /></div>
                <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-lg font-bold text-amber-600">{fmt(summary.pendentes)}</p></div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-xs text-muted-foreground">Pagos</p><p className="text-lg font-bold text-green-600">{fmt(summary.pagos)}</p></div>
              </div>
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              </div>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"><Download className="h-4 w-4" /> Exportar</button>
                )}
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Novo Lançamento</button>
              </div>
            </div>

            {/* Table */}
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
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground">Valor</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Vencimento</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Pagamento</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Obra</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Fornecedor</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Empresa</th>
                        <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`border-b border-border cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                          <td className="px-3 py-2.5 text-foreground font-medium max-w-[200px] truncate">{item.description}</td>
                          <td className={`px-3 py-2.5 font-medium ${typeColor[item.type] || "text-foreground"}`}>
                            {TYPE_OPTIONS.find(o => o.value === item.type)?.label ?? item.type}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-medium ${typeColor[item.type] || "text-foreground"}`}>{fmt(Number(item.value))}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[item.status] || "bg-muted text-muted-foreground"}`}>
                              {STATUS_OPTIONS.find(o => o.value === item.status)?.label ?? item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.payment_date ? new Date(item.payment_date).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.category || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{(item as any).obras?.name || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{(item as any).suppliers?.name || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{(item as any).companies?.name || "—"}</td>
                          <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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

      {/* Form modal - tabbed, 85vh */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl flex flex-col" style={{ height: "85vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Novo"} Lançamento</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted">
              {[
                { key: "dados", label: "Dados" },
                { key: "pagamento", label: "Pagamento" },
                { key: "vinculacoes", label: "Vinculações" },
                { key: "observacoes", label: "Observações" },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModalTab(tab.key)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${modalTab === tab.key ? "text-primary border-b-2 border-primary bg-card" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="flex-1 overflow-y-auto p-5">
              {modalTab === "dados" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Tipo *</label>
                      <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={inputClass}>
                        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Origem</label>
                      <select value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))} className={inputClass}>
                        {ORIGIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Descrição *</label>
                    <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required className={inputClass} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Valor (R$) *</label>
                      <input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Categoria</label>
                      <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Nº Documento / NF</label>
                      <input value={form.document_number} onChange={e => setForm(p => ({ ...p, document_number: e.target.value }))} className={inputClass} placeholder="Ex: NF-001234" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Centro de Custo</label>
                      <input value={form.cost_center} onChange={e => setForm(p => ({ ...p, cost_center: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Vencimento</label>
                      <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Data de Pagamento</label>
                      <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "pagamento" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Forma de Pagamento</label>
                      <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {PAYMENT_METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Condição de Pagamento</label>
                      <input value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className={inputClass} placeholder="Ex: 30/60/90 dias" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Nº de Parcelas</label>
                      <input type="number" min="1" value={form.installments} onChange={e => setForm(p => ({ ...p, installments: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Parcela Atual</label>
                      <input type="number" min="1" value={form.current_installment} onChange={e => setForm(p => ({ ...p, current_installment: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  {/* Summary */}
                  <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
                    <h4 className="font-medium text-card-foreground mb-3">Resumo Financeiro</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Total</span>
                      <span className="font-medium text-card-foreground">{fmt(parseFloat(form.value) || 0)}</span>
                    </div>
                    {parseInt(form.installments) > 1 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor por Parcela</span>
                        <span className="font-medium text-card-foreground">{fmt((parseFloat(form.value) || 0) / (parseInt(form.installments) || 1))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`font-medium ${form.status === "pago" ? "text-emerald-600" : form.status === "cancelado" ? "text-destructive" : "text-amber-600"}`}>
                        {STATUS_OPTIONS.find(s => s.value === form.status)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "vinculacoes" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Empresa</label>
                    <select value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} className={inputClass}>
                      <option value="">Nenhuma</option>
                      {companiesList.map(c => <option key={c.id} value={c.id}>{c.company_type === "filial" ? "↳ " : ""}{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Obra</label>
                      <select value={form.obra_id} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                        <option value="">Nenhuma</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-1">Fornecedor</label>
                      <select value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))} className={inputClass}>
                        <option value="">Nenhum</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Cliente</label>
                    <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} className={inputClass}>
                      <option value="">Nenhum</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {modalTab === "observacoes" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Observações</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={6} className={inputClass} placeholder="Informações adicionais sobre o lançamento..." />
                  </div>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-border bg-muted rounded-b-xl">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
              <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.description} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </div>
  );
}
