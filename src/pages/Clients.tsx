import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Upload,
  Eraser
} from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";
import { fetchCep } from "@/utils/cep";
import Attachments from "@/components/Attachments";
import CsvImport from "@/components/CsvImport";
import ClientContacts from "@/components/ClientContacts";
import ClientMessages from "@/components/ClientMessages";
import ClientPortalPermissions from "@/components/ClientPortalPermissions";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const CATEGORIAS = [
  { value: "prospect", label: "Prospect" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "efetivo", label: "Efetivo" },
];

const MARITAL_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
];

const ALL_TABS = [
  { key: "dados", label: "Dados" },
  { key: "contacts", label: "Contatos" },
  { key: "messages", label: "Atendimento" },
  { key: "anexos", label: "Anexos" },
  { key: "portal", label: "Acessos" },
];

const PAGE_SIZE = 15;
const OBS_MAX_LEN = 4000;

export default function Clients() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filter panel state
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterType, setFilterType] = useState<"f" | "j" | "todos">("todos");
  const [filterName, setFilterName] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDocument, setFilterDocument] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCondition, setFilterCondition] = useState<"ativo" | "inativo" | "ambos">("ativo");
  const [searched, setSearched] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Form / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Data
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Filtered results
  const filtered = searched
    ? items.filter((item) => {
        if (filterType !== "todos" && item.person_type !== filterType) return false;
        if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterDocument && !item.document?.includes(filterDocument.replace(/\D/g, ""))) return false;
        if (filterState && item.state !== filterState) return false;
        if (filterCity && !item.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
        if (filterCondition === "ativo" && !item.active) return false;
        if (filterCondition === "inativo" && item.active) return false;
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
        const { error } = await supabase.from("clients").update(values).eq("id", editing.id);
        if (error) throw error;
        return editing;
      } else {
        const { data, error } = await supabase.from("clients").insert({ ...values, user_id: user!.id } as any).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (savedClient: any) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      // Keep modal open and set editing to the saved client so tabs work
      setEditing(savedClient);
      setForm({ ...savedClient });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("clients").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fields = [
    { name: "name", label: "Nome" },
    { name: "category", label: "Categoria" },
    { name: "document", label: "CPF/CNPJ" },
    { name: "email", label: "Email" },
    { name: "phone", label: "Telefone" },
    { name: "city", label: "Cidade" },
    { name: "state", label: "UF" },
  ];

  const openNew = () => {
    setEditing(null);
    setForm({ person_type: "f" });
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ ...item });
    setActiveTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm({});
    setActiveTab("dados");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleCepBlur = async (value: string) => {
    setCepLoading(true);
    const result = await fetchCep(value);
    setCepLoading(false);
    if (result) {
      setForm((p) => ({ ...p, city: result.city, state: result.state, address: result.address }));
      toast.success("Endereço preenchido!");
    } else if (value.replace(/\D/g, "").length === 8) {
      toast.error("CEP não encontrado");
    }
  };

  const handleSearch = () => {
    setSearched(true);
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilterType("todos");
    setFilterName("");
    setFilterCategory("");
    setFilterDocument("");
    setFilterState("");
    setFilterCity("");
    setFilterCondition("ativo");
    setSearched(false);
    setPage(0);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const needsSaveFirst = !editing && activeTab !== "dados";
  const obsRemaining = OBS_MAX_LEN - (form.notes?.length || 0);

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel + Toggle */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Search className="h-5 w-5" />
                Clientes
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tipo</label>
                <div className="flex gap-4">
                  {([["f", "P. Física"], ["j", "P. Jurídica"], ["todos", "Todos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterType" checked={filterType === val} onChange={() => setFilterType(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CPF/CNPJ</label>
                <input type="text" value={filterDocument} onChange={(e) => setFilterDocument(maskCpfCnpj(e.target.value))} placeholder="CPF ou CNPJ" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
                <input type="text" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex gap-4">
                  {([["ativo", "Ativo"], ["inativo", "Inativo"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterCondition" checked={filterCondition === val} onChange={() => setFilterCondition(val)} className="accent-primary" />
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
                <div className="mt-3">
                  <button onClick={() => setImportOpen(true)} className="text-primary font-medium text-sm hover:underline uppercase tracking-wide">
                    Importar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              </h3>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={() => exportToCSV(filtered, fields, "clients")} className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
                    <Download className="h-4 w-4" /> Exportar
                  </button>
                )}
                <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <Plus className="h-4 w-4" /> Novo
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado com os filtros aplicados.</div>
            ) : (
              <>
                <div className="flex-1 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/50">
                        <th className="w-16 px-4 py-3 font-medium text-muted-foreground">Ativo</th>
                        {fields.map((f) => (
                          <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground">{f.label}</th>
                        ))}
                        <th className="w-24 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedItems.map((item) => (
                        <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${!item.active ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })}
                              className={`relative h-6 w-11 rounded-full transition-colors ${item.active ? "bg-primary" : "bg-muted-foreground/30"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${item.active ? "translate-x-5" : ""}`} />
                            </button>
                          </td>
                          {fields.map((f) => {
                            let display = item[f.name] ?? "—";
                            if (f.name === "category" && item[f.name]) {
                              const opt = CATEGORIAS.find((o) => o.value === item[f.name]);
                              display = opt ? opt.label : item[f.name];
                            }
                            return <td key={f.name} className="px-4 py-3 text-foreground">{String(display)}</td>;
                          })}
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
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
                      <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-md text-sm font-medium ${i === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"}`}>{i + 1}</button>
                      )).slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3))}
                      <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Novo"} cliente</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs bar - distinct background */}
            <div className="flex bg-muted px-5 gap-1 border-b border-border">
              {ALL_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === t.key
                      ? "border-primary text-primary bg-card rounded-t-lg"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content - scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* DADOS tab */}
              {activeTab === "dados" && (
                <form id="client-form" onSubmit={handleSubmit} className="p-5 space-y-5">
                  {/* Nome - full width */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[80px] text-right">Nome *</label>
                    <input value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} />
                  </div>

                  {/* Tipo + Categoria */}
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[80px] text-right">Tipo</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                          <input type="radio" name="personType" checked={form.person_type === "f"} onChange={() => setForm((p) => ({ ...p, person_type: "f" }))} className="accent-primary" />
                          Pessoa física
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                          <input type="radio" name="personType" checked={form.person_type === "j"} onChange={() => setForm((p) => ({ ...p, person_type: "j" }))} className="accent-primary" />
                          Pessoa jurídica
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Categoria</label>
                      <select value={form.category ?? ""} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputClass + " w-40"}>
                        <option value="">Selecione...</option>
                        {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* CPF/RG/Dt.nasc */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">{form.person_type === "j" ? "CNPJ" : "CPF"}</label>
                      <input type="text" value={form.document ?? ""} onChange={(e) => setForm((p) => ({ ...p, document: maskCpfCnpj(e.target.value) }))} placeholder={form.person_type === "j" ? "00.000.000/0000-00" : "000.000.000-00"} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">RG</label>
                      <input value={form.rg ?? ""} onChange={(e) => setForm((p) => ({ ...p, rg: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Dt. nasc.</label>
                      <input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Nacionalidade / Estado Civil / Profissão */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Nacionalidade</label>
                      <input value={form.nationality ?? ""} onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Estado Civil</label>
                      <select value={form.marital_status ?? ""} onChange={(e) => setForm((p) => ({ ...p, marital_status: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Profissão</label>
                      <input value={form.profession ?? ""} onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="flex items-start gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[80px] text-right pt-2">Observação</label>
                    <div className="flex-1">
                      <textarea value={form.notes ?? ""} onChange={(e) => { if (e.target.value.length <= OBS_MAX_LEN) setForm((p) => ({ ...p, notes: e.target.value })); }} rows={3} className={inputClass} />
                      <p className="text-xs text-muted-foreground text-right mt-1">{obsRemaining.toLocaleString("pt-BR")} caracteres restantes</p>
                    </div>
                  </div>

                  {/* Seção Contato */}
                  <fieldset className="border border-border rounded-lg p-4">
                    <legend className="text-sm font-semibold text-muted-foreground px-2">Contato</legend>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Telefone</label>
                        <input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Celular</label>
                        <input value={form.cellphone ?? ""} onChange={(e) => setForm((p) => ({ ...p, cellphone: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">E-mail</label>
                        <input type="email" value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Seção Endereço */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-4">
                    <legend className="text-sm font-semibold text-muted-foreground px-2">Endereço</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">CEP</label>
                        <div className="relative flex-1">
                          <input type="text" value={form.cep ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v; setForm((p) => ({ ...p, cep: formatted })); }} onBlur={(e) => handleCepBlur(e.target.value)} placeholder="00000-000" className={inputClass} />
                          {cepLoading && <div className="absolute right-3 top-2.5"><div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /></div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Logradouro</label>
                        <input value={form.address ?? ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Número</label>
                        <input value={form.address_number ?? ""} onChange={(e) => setForm((p) => ({ ...p, address_number: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Bairro</label>
                        <input value={form.neighborhood ?? ""} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Complemento</label>
                        <input value={form.complement ?? ""} onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Estado</label>
                        <select value={form.state ?? ""} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className={inputClass}>
                          <option value="">Selecione...</option>
                          {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-card-foreground whitespace-nowrap">Cidade</label>
                        <input value={form.city ?? ""} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>
                </form>
              )}

              {/* Other tabs - need save first */}
              {needsSaveFirst && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">Salve o cliente primeiro para acessar esta aba.</p>
                </div>
              )}

              {activeTab === "contacts" && editing && (
                <div className="p-5"><ClientContacts clientId={editing.id} /></div>
              )}
              {activeTab === "messages" && editing && (
                <div className="p-5"><ClientMessages clientId={editing.id} /></div>
              )}
              {activeTab === "anexos" && editing && (
                <div className="p-5"><Attachments entityType="clients" entityId={editing.id} /></div>
              )}
              {activeTab === "portal" && editing && (
                <div className="p-5"><ClientPortalPermissions clientId={editing.id} /></div>
              )}
            </div>

            {/* Bottom bar - fixed */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border bg-muted rounded-b-xl">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">
                Cancelar
              </button>
              {activeTab === "dados" && (
                <button type="submit" form="client-form" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importOpen && (
        <CsvImport
          table="clients"
          queryKey="clients"
          fields={fields.map(f => ({ name: f.name, label: f.label }))}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
