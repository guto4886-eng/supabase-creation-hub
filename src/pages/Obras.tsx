import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Eraser,
  FileText, Power
} from "lucide-react";
import { exportCSV, exportExcel, exportPDF, fetchCompanyInfo } from "@/utils/exportWithHeader";
import ExportDialog from "@/components/ExportDialog";
import { fetchCep } from "@/utils/cep";
import ObraFolders from "@/components/ObraFolders";
import ObraContacts from "@/components/ObraContacts";
import ObraDailyEntries from "@/components/ObraDailyEntries";
import ObraServiceMessages from "@/components/ObraServiceMessages";
import ObraConfig from "@/components/ObraConfig";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const STATUS_OPTIONS = [
  { value: "cancelada", label: "Cancelada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Finalizada" },
  { value: "nao_iniciada", label: "Não iniciada" },
  { value: "pausada", label: "Paralisada" },
];

const CATEGORIA_OBRAS = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "reforma", label: "Reforma" },
  { value: "infraestrutura", label: "Infraestrutura" },
];

const ALL_TABS = [
  { key: "dados", label: "Dados" },
  { key: "endereco", label: "Endereço" },
  { key: "contatos", label: "Contatos" },
  { key: "diadia", label: "Dia a dia" },
  { key: "pasta", label: "Pasta da obra" },
  { key: "atendimento", label: "Atendimento" },
  { key: "config", label: "Configurações" },
];

const PAGE_SIZE = 15;
const OBS_MAX_LEN = 4000;

export default function Obras() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filter panel state
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterAddress, setFilterAddress] = useState("");
  const [filterCondition, setFilterCondition] = useState<"ativo" | "inativo" | "ambos">("ativo");
  const [filterStock, setFilterStock] = useState<"sim" | "nao" | "ambos">("ambos");
  const [filterCompany, setFilterCompany] = useState("");
  const [searched, setSearched] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Form / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);

  // Data
  const { data: companiesList = [] } = useCompanies();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch budgets linked to obras for sequential numbering
  const { data: allBudgets = [] } = useQuery({
    queryKey: ["budgets_for_obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("id, obra_id, created_at").order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; obra_id: string; created_at: string }[];
    },
  });

  // Build a map: obra_id -> "ORC-001" (sequential number based on budget creation order)
  const budgetNumberMap = useMemo(() => {
    const map: Record<string, string> = {};
    allBudgets.forEach((b, idx) => {
      if (b.obra_id && !map[b.obra_id]) {
        map[b.obra_id] = `ORC-${String(idx + 1).padStart(3, "0")}`;
      }
    });
    return map;
  }, [allBudgets]);

  const tableFields = useMemo(() => [
    { name: "name", label: "Nome" },
    { name: "client_id", label: "Cliente" },
    { name: "city_state", label: "Cidade - UF" },
    { name: "start_date", label: "Início" },
    { name: "expected_end_date", label: "Fim" },
    { name: "total_budget", label: "Orçamento" },
    { name: "medido", label: "Medido" },
    { name: "category", label: "Categoria" },
    { name: "status", label: "Situação" },
    { name: "stock_control", label: "Controla estoque" },
  ], []);

  // Filtered results
  const filtered = searched
    ? items.filter((item) => {
        if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterClient && item.client_id !== filterClient) return false;
        if (filterStatuses.length > 0 && !filterStatuses.includes(item.status)) return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterState && item.state !== filterState) return false;
        if (filterCity && !item.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
        if (filterNeighborhood && !item.neighborhood?.toLowerCase().includes(filterNeighborhood.toLowerCase())) return false;
        if (filterAddress && !item.address?.toLowerCase().includes(filterAddress.toLowerCase())) return false;
        if (filterCondition === "ativo" && !item.active) return false;
        if (filterCondition === "inativo" && item.active) return false;
        if (filterCompany && item.company_id !== filterCompany) return false;
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("obras").update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obras").insert({ ...values, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("obras").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formFields = [
    "name", "client_id", "category", "status", "notes",
    "start_date", "duration", "duration_unit", "expected_end_date",
    "cno", "area_m2", "empreiteiro", "resp_tecnico", "art_number", "resp_obra",
    "cep", "address", "address_number", "neighborhood", "complement", "state", "city",
    "billing_cep", "billing_address", "billing_number", "billing_neighborhood", "billing_complement", "billing_state", "billing_city", "billing_address_source",
    "stock_control", "stock_type", "client_access", "billing_type", "billing_frequency", "document_type", "planning_frequency", "tracking_method", "work_days",
    "total_budget", "description", "rdo_sections",
  ];

  const openNew = () => {
    setEditing(null);
    const initial: Record<string, any> = {};
    formFields.forEach((f) => (initial[f] = ""));
    initial.status = "nao_iniciada";
    initial.billing_frequency = "semanal";
    initial.planning_frequency = "mensal";
    initial.tracking_method = "custo";
    initial.billing_address_source = "obra";
    initial.stock_control = false;
    initial.client_access = false;
    initial.work_days = ["seg", "ter", "qua", "qui", "sex"];
    initial.duration_unit = "meses";
    setForm(initial);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const initial: Record<string, any> = {};
    formFields.forEach((f) => (initial[f] = item[f] ?? ""));
    if (item.work_days) initial.work_days = item.work_days;
    setForm(initial);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm({});
    setActiveTab("dados");
    setReportMenuOpen(false);
  };

  const generateObraDataPDF = async () => {
    if (!editing) return;
    const doc = new (await import("jspdf")).default();
    const company = user ? await fetchCompanyInfo(user.id) : null;
    let y = 15;
    if (company?.company_name) { doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(company.company_name, 14, y); y += 7; }
    if (company?.document) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`CNPJ/CPF: ${company.document}`, 14, y); y += 5; }
    y += 5;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("DADOS DA OBRA", 14, y); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const fields = [
      ["Nome", editing.name], ["Cliente", editing.client_id ? getClientName(editing.client_id) : "—"],
      ["Categoria", editing.category ? getCategoryLabel(editing.category) : "—"], ["Situação", getStatusLabel(editing.status)],
      ["CNO", editing.cno || "—"], ["Área (m²)", editing.area_m2 || "—"], ["ART", editing.art_number || "—"],
      ["Resp. Técnico", editing.resp_tecnico || "—"], ["Resp. Obra", editing.resp_obra || "—"],
      ["Empreiteiro", editing.empreiteiro || "—"],
      ["Início", editing.start_date ? new Date(editing.start_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
      ["Fim previsto", editing.expected_end_date ? new Date(editing.expected_end_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
      ["Endereço", [editing.address, editing.address_number, editing.neighborhood, editing.city, editing.state].filter(Boolean).join(", ") || "—"],
      ["CEP", editing.cep || "—"], ["Orçamento", budgetNumberMap[editing.id] || "—"],
      ["Controla estoque", editing.stock_control ? "Sim" : "Não"],
    ];
    fields.forEach(([label, val]) => { doc.text(`${label}: ${val}`, 14, y); y += 5; if (y > 280) { doc.addPage(); y = 15; } });
    doc.save(`Obra_${editing.name.replace(/\s+/g, "_")}.pdf`);
    toast.success("Relatório gerado!");
  };

  const generateRDOPDF = async () => {
    if (!editing) return;
    const doc = new (await import("jspdf")).default();
    const { default: autoTable } = await import("jspdf-autotable");
    const company = user ? await fetchCompanyInfo(user.id) : null;
    let y = 15;
    if (company?.company_name) { doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(company.company_name, 14, y); y += 7; }
    if (company?.document) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`CNPJ/CPF: ${company.document}`, 14, y); y += 5; }
    y += 5;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(`RDO - ${editing.name}`, 14, y); y += 8;
    // Fetch daily entries
    const { data: entries } = await supabase.from("obra_daily_entries" as any).select("*").eq("obra_id", editing.id).order("entry_date", { ascending: false });
    if (entries && entries.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Data", "Fase", "Serviço", "Mensagem", "Cliente"]],
        body: (entries as any[]).map((e: any) => [
          e.entry_date ? new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR") : "",
          e.phase || "", e.service || "", e.message || "", e.show_to_client ? "Sim" : "Não",
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    } else {
      doc.setFontSize(9); doc.text("Nenhum registro encontrado.", 14, y);
    }
    doc.save(`RDO_${editing.name.replace(/\s+/g, "_")}.pdf`);
    toast.success("RDO gerado!");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error("Nome da obra é obrigatório"); return; }
    // Clean form: convert empty strings to null for nullable fields, parse numbers
    const numericFields = ["total_budget", "area_m2", "duration"];
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(form)) {
      if (numericFields.includes(key)) {
        cleaned[key] = value === "" || value === null || value === undefined ? null : Number(value);
      } else if (value === "") {
        cleaned[key] = null;
      } else {
        cleaned[key] = value;
      }
    }
    // Ensure required fields are not null
    cleaned.name = form.name.trim();
    cleaned.status = form.status || "nao_iniciada";
    saveMutation.mutate(cleaned);
  };

  const handleCepBlur = async (value: string, prefix = "") => {
    setCepLoading(true);
    const result = await fetchCep(value);
    setCepLoading(false);
    if (result) {
      if (prefix) {
        setForm((p) => ({ ...p, [`${prefix}address`]: result.address, [`${prefix}city`]: result.city, [`${prefix}state`]: result.state }));
      } else {
        setForm((p) => ({ ...p, address: result.address, city: result.city, state: result.state, neighborhood: result.neighborhood || p.neighborhood }));
      }
      toast.success("Endereço preenchido!");
    } else if (value.replace(/\D/g, "").length === 8) {
      toast.error("CEP não encontrado");
    }
  };

  const handleSearch = () => { setSearched(true); setPage(0); };

  const handleClearFilters = () => {
    setFilterName(""); setFilterClient(""); setFilterStatuses([]); setFilterCategory("");
    setFilterState(""); setFilterCity(""); setFilterNeighborhood(""); setFilterAddress("");
    setFilterCondition("ativo"); setFilterStock("ambos"); setFilterCompany(""); setSearched(false); setPage(0);
  };

  const getClientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const getStatusLabel = (val: string) => STATUS_OPTIONS.find(o => o.value === val)?.label ?? val;
  const getCategoryLabel = (val: string) => CATEGORIA_OBRAS.find(o => o.value === val)?.label ?? val;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const formatCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  // Visible tabs: new obra only shows Dados + Endereço, editing shows all
  const visibleTabs = editing ? ALL_TABS : ALL_TABS.slice(0, 2);

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel + Toggle */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Search className="h-5 w-5" /> Obras
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <CompanyFilterSelect value={filterCompany} onChange={setFilterCompany} companies={companiesList} className={inputClass} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome (obra)</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cliente</label>
                <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Situação</label>
                <div className="space-y-1.5">
                  {STATUS_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={filterStatuses.includes(o.value)} onChange={(e) => {
                        if (e.target.checked) setFilterStatuses(p => [...p, o.value]);
                        else setFilterStatuses(p => p.filter(v => v !== o.value));
                      }} className="h-4 w-4 rounded border-input accent-primary" />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {CATEGORIA_OBRAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
                <input type="text" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Bairro</label>
                <input type="text" value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Logradouro</label>
                <input type="text" value={filterAddress} onChange={(e) => setFilterAddress(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex gap-4">
                  {([["ativo", "Ativo"], ["inativo", "Inativo"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterCondObras" checked={filterCondition === val} onChange={() => setFilterCondition(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Controla estoque</label>
                <div className="flex gap-4">
                  {([["sim", "Sim"], ["nao", "Não"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterStockObras" checked={filterStock === val} onChange={() => setFilterStock(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
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

        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${filtersOpen ? "bg-primary" : "bg-amber-700"}`} />
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-amber-700"}`} title={filtersOpen ? "Fechar filtros" : "Filtros de pesquisa"}>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1" style={{ writingMode: "vertical-lr" }}>
              FILTROS DE PESQUISA {filtersOpen ? "‹" : "›"}
            </span>
          </button>
        </div>
      </div>

      {/* Main content area */}
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
                  Clique em <button onClick={() => setFiltersOpen(true)} className="text-primary font-medium hover:underline">filtros de pesquisa</button>, informe o que procura nos campos de busca, clique em "Pesquisar" e aguarde que os resultados aparecerão aqui.
                </p>
              </div>
              <div className="w-px h-48 bg-border" />
              <div className="text-center flex-1">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Plus className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Inclua um novo registro!</h3>
                <p className="text-sm text-muted-foreground mb-4">Você também pode incluir um novo registro agora.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
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
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado com os filtros aplicados.</div>
            ) : (
              <>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-amber-700 text-white">
                        {tableFields.map(f => <th key={f.name} className="text-left px-2 py-2 font-semibold whitespace-nowrap">{f.label}</th>)}
                        <th className="px-2 py-2 font-semibold text-center whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`cursor-pointer hover:bg-primary/10 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                          {tableFields.map(f => {
                            let content: React.ReactNode = "—";
                            if (f.name === "name") content = <span className="truncate max-w-[160px] block">{item.name || "—"}</span>;
                            else if (f.name === "client_id") content = <span className="truncate max-w-[160px] block">{item.client_id ? getClientName(item.client_id) : "—"}</span>;
                            else if (f.name === "city_state") content = [item.city, item.state].filter(Boolean).join("/") || "—";
                            else if (f.name === "start_date" || f.name === "expected_end_date") {
                              const d = item[f.name === "expected_end_date" ? "expected_end_date" : "start_date"];
                              content = d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "";
                            }
                            else if (f.name === "total_budget") content = budgetNumberMap[item.id] || "—";
                            else if (f.name === "medido") {
                              const pct = 0; // placeholder - no measured field yet
                              content = (
                                <div className="flex items-center gap-1.5 min-w-[100px]">
                                  <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                                    <div className={`h-full rounded-sm ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-yellow-400" : "bg-muted-foreground/20"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{pct.toFixed(2)}%</span>
                                </div>
                              );
                            }
                            else if (f.name === "category") content = item.category ? getCategoryLabel(item.category) : "—";
                            else if (f.name === "status") content = item.status ? getStatusLabel(item.status) : "—";
                            else if (f.name === "stock_control") content = item.stock_control ? "Sim" : "Não";
                            return <td key={f.name} className="px-2 py-2 text-foreground">{content}</td>;
                          })}
                          <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-0.5 justify-center">
                              <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
                      <Plus className="h-3.5 w-3.5" /> Nova
                    </button>
                    {filtered.length > 0 && (
                      <button onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-primary text-xs hover:underline">
                        <Download className="h-3.5 w-3.5" /> Exportar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(0)} disabled={currentPage === 0} className="p-1 rounded hover:bg-accent disabled:opacity-30">⟨</button>
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1 rounded hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
                        <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-medium min-w-[24px] text-center">{currentPage + 1}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1 rounded hover:bg-accent disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setPage(totalPages - 1)} disabled={currentPage === totalPages - 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">⟩</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-primary">
                {editing ? `Obra: ${editing.name}${editing.client_id ? ` - Cliente: ${getClientName(editing.client_id)}` : ""}` : "Nova obra"}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
              {visibleTabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px text-center ${activeTab === t.key ? "border-primary text-primary bg-card" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content - scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* ─── DADOS ─── */}
              {activeTab === "dados" && (
                <form id="obra-form" onSubmit={handleSubmit} className="p-5 space-y-5">
                  {/* Cliente + Nome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Cliente *</label>
                      <select value={form.client_id || ""} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} required className={inputClass}>
                        <option value="">Selecione...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Nome da obra *</label>
                    <input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className={inputClass} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Categoria *</label>
                      <select value={form.category || ""} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required className={inputClass}>
                        <option value="">Selecione...</option>
                        {CATEGORIA_OBRAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Situação *</label>
                      <select value={form.status || ""} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} required className={inputClass}>
                        <option value="">Selecione...</option>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Observação</label>
                    <textarea value={form.notes || ""} onChange={e => { if (e.target.value.length <= OBS_MAX_LEN) setForm(p => ({ ...p, notes: e.target.value })); }} rows={5} className={inputClass} />
                    <p className="text-xs text-muted-foreground text-right mt-1">{OBS_MAX_LEN - (form.notes?.length || 0)} caracteres restantes</p>
                  </div>

                  {/* Período */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground">Período</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Data início</label>
                        <input type="date" value={form.start_date || ""} onChange={e => {
                          const start = e.target.value;
                          setForm(p => {
                            const next: Record<string, any> = { ...p, start_date: start };
                            if (start && p.duration) {
                              const d = new Date(start + "T00:00:00");
                              const unit = p.duration_unit || "meses";
                              if (unit === "meses") d.setMonth(d.getMonth() + Number(p.duration));
                              else if (unit === "dias") d.setDate(d.getDate() + Number(p.duration));
                              else if (unit === "semanas") d.setDate(d.getDate() + Number(p.duration) * 7);
                              else if (unit === "anos") d.setFullYear(d.getFullYear() + Number(p.duration));
                              next.expected_end_date = d.toISOString().slice(0, 10);
                            }
                            return next;
                          });
                        }} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Duração</label>
                        <input type="number" value={form.duration || ""} onChange={e => {
                          const dur = e.target.value;
                          setForm(p => {
                            const next: Record<string, any> = { ...p, duration: dur };
                            if (p.start_date && dur) {
                              const d = new Date(p.start_date + "T00:00:00");
                              const unit = p.duration_unit || "meses";
                              if (unit === "meses") d.setMonth(d.getMonth() + Number(dur));
                              else if (unit === "dias") d.setDate(d.getDate() + Number(dur));
                              else if (unit === "semanas") d.setDate(d.getDate() + Number(dur) * 7);
                              else if (unit === "anos") d.setFullYear(d.getFullYear() + Number(dur));
                              next.expected_end_date = d.toISOString().slice(0, 10);
                            }
                            return next;
                          });
                        }} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Unidade</label>
                        <select value={form.duration_unit || "meses"} onChange={e => {
                          const unit = e.target.value;
                          setForm(p => {
                            const next: Record<string, any> = { ...p, duration_unit: unit };
                            if (p.start_date && p.duration) {
                              const d = new Date(p.start_date + "T00:00:00");
                              if (unit === "meses") d.setMonth(d.getMonth() + Number(p.duration));
                              else if (unit === "dias") d.setDate(d.getDate() + Number(p.duration));
                              else if (unit === "semanas") d.setDate(d.getDate() + Number(p.duration) * 7);
                              else if (unit === "anos") d.setFullYear(d.getFullYear() + Number(p.duration));
                              next.expected_end_date = d.toISOString().slice(0, 10);
                            }
                            return next;
                          });
                        }} className={inputClass}>
                          <option value="meses">Mês(es)</option>
                          <option value="dias">Dia(s)</option>
                          <option value="semanas">Semana(s)</option>
                          <option value="anos">Ano(s)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Data fim</label>
                        <input type="date" value={form.expected_end_date || ""} onChange={e => setForm(p => ({ ...p, expected_end_date: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Outras informações */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground">Outras informações</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">CNO</label>
                        <input value={form.cno || ""} onChange={e => setForm(p => ({ ...p, cno: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Área (m²)</label>
                        <input type="number" step="0.01" value={form.area_m2 || ""} onChange={e => setForm(p => ({ ...p, area_m2: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Empreiteiro</label>
                        <input value={form.empreiteiro || ""} onChange={e => setForm(p => ({ ...p, empreiteiro: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Resp. técnico</label>
                        <input value={form.resp_tecnico || ""} onChange={e => setForm(p => ({ ...p, resp_tecnico: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">ART nº</label>
                        <input value={form.art_number || ""} onChange={e => setForm(p => ({ ...p, art_number: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Resp. obra</label>
                        <input value={form.resp_obra || ""} onChange={e => setForm(p => ({ ...p, resp_obra: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>
                </form>
              )}

              {/* ─── ENDEREÇO ─── */}
              {activeTab === "endereco" && (
                <div className="p-5 space-y-6">
                  {/* Endereço da obra */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground">Endereço da obra</legend>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">CEP</label>
                        <div className="relative">
                          <input value={form.cep || ""} onChange={e => setForm(p => ({ ...p, cep: formatCep(e.target.value) }))} onBlur={e => handleCepBlur(e.target.value)} placeholder="00000-000" className={inputClass} />
                          {cepLoading && <div className="absolute right-3 top-2.5"><div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /></div>}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-foreground mb-1">Logradouro</label>
                        <input value={form.address || ""} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Número</label>
                        <input value={form.address_number || ""} onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Bairro</label>
                        <input value={form.neighborhood || ""} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Complemento</label>
                        <input value={form.complement || ""} onChange={e => setForm(p => ({ ...p, complement: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Estado</label>
                        <select value={form.state || ""} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={inputClass}>
                          <option value="">Selecione...</option>
                          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Cidade</label>
                        <input value={form.city || ""} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Endereço de cobrança */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground">Endereço de cobrança</legend>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-sm text-foreground mr-2">Usar o mesmo de:</span>
                      {(["obra", "cliente", "empresa", "outro"] as const).map(val => (
                        <label key={val} className="flex items-center gap-1 text-sm cursor-pointer mr-3">
                          <input type="radio" checked={form.billing_address_source === val} onChange={() => {
                            setForm(p => ({ ...p, billing_address_source: val }));
                            if (val === "obra") {
                              setForm(p => ({
                                ...p, billing_cep: p.cep, billing_address: p.address, billing_number: p.address_number,
                                billing_neighborhood: p.neighborhood, billing_complement: p.complement, billing_state: p.state, billing_city: p.city,
                              }));
                            }
                          }} className="accent-primary" />
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">CEP</label>
                        <input value={form.billing_cep || ""} onChange={e => setForm(p => ({ ...p, billing_cep: formatCep(e.target.value) }))} onBlur={e => handleCepBlur(e.target.value, "billing_")} placeholder="00000-000" className={inputClass} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-foreground mb-1">Logradouro</label>
                        <input value={form.billing_address || ""} onChange={e => setForm(p => ({ ...p, billing_address: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Número</label>
                        <input value={form.billing_number || ""} onChange={e => setForm(p => ({ ...p, billing_number: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Bairro</label>
                        <input value={form.billing_neighborhood || ""} onChange={e => setForm(p => ({ ...p, billing_neighborhood: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Complemento</label>
                        <input value={form.billing_complement || ""} onChange={e => setForm(p => ({ ...p, billing_complement: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Estado</label>
                        <select value={form.billing_state || ""} onChange={e => setForm(p => ({ ...p, billing_state: e.target.value }))} className={inputClass}>
                          <option value="">Selecione...</option>
                          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Cidade</label>
                        <input value={form.billing_city || ""} onChange={e => setForm(p => ({ ...p, billing_city: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>
                </div>
              )}

              {/* ─── CONTATOS ─── */}
              {activeTab === "contatos" && editing && <ObraContacts obraId={editing.id} />}
              {activeTab === "contatos" && !editing && <div className="p-5 text-muted-foreground text-center py-12">Salve a obra primeiro para gerenciar contatos.</div>}

              {/* ─── DIA A DIA ─── */}
              {activeTab === "diadia" && editing && <ObraDailyEntries obraId={editing.id} />}

              {/* ─── PASTA DA OBRA ─── */}
              {activeTab === "pasta" && editing && <ObraFolders obraId={editing.id} />}

              {/* ─── ATENDIMENTO ─── */}
              {activeTab === "atendimento" && editing && <ObraServiceMessages obraId={editing.id} />}

              {/* ─── CONFIGURAÇÕES ─── */}
              {activeTab === "config" && editing && <ObraConfig obraId={editing.id} form={form} setForm={setForm} />}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted rounded-b-xl">
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg bg-background text-foreground border border-border hover:bg-muted/80 text-sm">
                  Cancelar
                </button>

                {/* Relatórios dropdown */}
                {editing && (
                  <div className="relative">
                    <button type="button" onClick={() => setReportMenuOpen(p => !p)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted/80">
                      <FileText className="h-4 w-4" /> Relatórios ▾
                    </button>
                    {reportMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[180px]">
                        <button onClick={() => { generateObraDataPDF(); setReportMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50 rounded-t-lg">
                          Dados da Obra
                        </button>
                        <button onClick={() => { generateRDOPDF(); setReportMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/50 rounded-b-lg border-t border-border">
                          RDO - Diário de Obra
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Ativo/Inativo */}
                {editing && (
                  <button
                    type="button"
                    onClick={() => { toggleActive.mutate({ id: editing.id, active: !editing.active }); setEditing((p: any) => p ? { ...p, active: !p.active } : p); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border ${editing.active ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-green-500/30 text-green-600 hover:bg-green-50"}`}
                  >
                    <Power className="h-4 w-4" /> {editing.active ? "Desativar" : "Ativar"}
                  </button>
                )}

                {/* Nova Obra */}
                <button type="button" onClick={() => { closeForm(); setTimeout(openNew, 100); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/5">
                  <Plus className="h-4 w-4" /> Nova Obra
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(activeTab === "dados" || activeTab === "endereco" || activeTab === "config") && (
                  <button type="submit" form="obra-form" onClick={(e) => { if (activeTab !== "dados") { e.preventDefault(); saveMutation.mutate(form); } }} disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          onSelect={async (format) => {
            setExportOpen(false);
            const company = user ? await fetchCompanyInfo(user.id) : null;
            const expFields = tableFields.map(f => ({ name: f.name, label: f.label }));
            if (format === "csv") exportCSV(filtered, expFields, "obras", company);
            else if (format === "excel") exportExcel(filtered, expFields, "obras", company);
            else if (format === "pdf") await exportPDF(filtered, expFields, "obras", company);
            toast.success("Arquivo exportado!");
          }}
        />
      )}
    </div>
  );
}
