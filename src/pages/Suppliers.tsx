import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Upload, Eraser,
  PanelLeftClose
} from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";
import { fetchCep } from "@/utils/cep";
import { fetchCnpj } from "@/utils/cnpjLookup";
import Attachments from "@/components/Attachments";
import CsvImport from "@/components/CsvImport";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const PAGE_SIZE = 15;

export default function Suppliers() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filter panel
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDocument, setFilterDocument] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCondition, setFilterCondition] = useState<"ativo" | "inativo" | "ambos">("ativo");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = searched
    ? items.filter((item) => {
        if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterCategory && !item.category?.toLowerCase().includes(filterCategory.toLowerCase())) return false;
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

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("suppliers").update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...values, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("suppliers").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fields = [
    { name: "name", label: "Razão social", required: true },
    { name: "trade_name", label: "Nome fantasia" },
    { name: "person_type", label: "Tipo" },
    { name: "document", label: "CPF/CNPJ", type: "cpfcnpj" as const },
    { name: "ie", label: "I.E." },
    { name: "notes", label: "Observação", type: "textarea" as const },
    { name: "recommended", label: "Parceiro recomendado", type: "checkbox" as const },
    { name: "phone", label: "Telefone", type: "tel" as const },
    { name: "email", label: "E-mail", type: "email" as const },
    { name: "cellphone", label: "Celular", type: "tel" as const },
    { name: "site", label: "Site" },
    { name: "cep", label: "CEP", type: "cep" as const },
    { name: "address", label: "Logradouro" },
    { name: "address_number", label: "Número" },
    { name: "complement", label: "Complemento" },
    { name: "neighborhood", label: "Bairro" },
    { name: "state", label: "UF" },
    { name: "city", label: "Cidade" },
    { name: "category", label: "Categoria" },
  ];

  const tableFields = [
    { name: "name", label: "Nome" },
    { name: "document", label: "CPF/CNPJ" },
    { name: "email", label: "Email" },
    { name: "phone", label: "Telefone" },
    { name: "category", label: "Categoria" },
    { name: "city", label: "Cidade" },
    { name: "state", label: "UF" },
  ];

  const openNew = () => {
    setEditing(null);
    const initial: Record<string, any> = {};
    fields.forEach((f) => (initial[f.name] = ""));
    initial.person_type = "j";
    initial.recommended = false;
    setForm(initial);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const initial: Record<string, any> = {};
    fields.forEach((f) => (initial[f.name] = item[f.name] ?? ""));
    setForm(initial);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); setActiveTab("dados"); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === "recommended") { cleaned[key] = !!value; continue; }
      cleaned[key] = value === "" ? null : value;
    }
    saveMutation.mutate(cleaned);
  };

  const handleCepBlur = async (value: string) => {
    setCepLoading(true);
    const result = await fetchCep(value);
    setCepLoading(false);
    if (result) {
      setForm((p) => ({ ...p, city: result.city, state: result.state, address: result.address, neighborhood: result.neighborhood }));
      toast.success("Endereço preenchido!");
    } else if (value.replace(/\D/g, "").length === 8) {
      toast.error("CEP não encontrado");
    }
  };

  const handleSearch = () => { setSearched(true); setPage(0); };

  const handleClearFilters = () => {
    setFilterName(""); setFilterCategory(""); setFilterDocument(""); setFilterState(""); setFilterCity(""); setFilterCondition("ativo"); setSearched(false); setPage(0);
  };

  const renderFormInput = (f: typeof fields[0]) => {
    if (f.type === "textarea") return <textarea value={form[f.name] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} required={f.required} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />;
    if (f.type === "cep") return (
      <div className="relative">
        <input type="text" value={form[f.name] ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v; setForm((p) => ({ ...p, [f.name]: formatted })); }} onBlur={(e) => handleCepBlur(e.target.value)} placeholder="00000-000" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        {cepLoading && <div className="absolute right-3 top-2.5"><div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /></div>}
      </div>
    );
    if (f.type === "cpfcnpj") {
      const val = form[f.name] ?? "";
      const digits = val.replace(/\D/g, "");
      const isComplete = digits.length === 11 || digits.length === 14;
      const { valid } = isComplete ? validateCpfCnpj(val) : { valid: true };
      return (
        <div>
          <input type="text" value={val} onChange={(e) => setForm((p) => ({ ...p, [f.name]: maskCpfCnpj(e.target.value) }))} placeholder="CPF ou CNPJ" className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isComplete && !valid ? "border-destructive" : "border-input"}`} />
          {isComplete && !valid && <p className="text-xs text-destructive mt-1">{digits.length === 11 ? "CPF" : "CNPJ"} inválido</p>}
        </div>
      );
    }
    return <input type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} required={f.required} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />;
  };

  const OBS_MAX_LEN = 4000;

  const allTabs = [
    { key: "dados", label: "Dados" },
    { key: "bancarios", label: "Dados bancários" },
    { key: "vendedores", label: "Vendedores" },
    { key: "categorias", label: "Categorias" },
    { key: "qualidade", label: "Qualidade" },
    ...(editing ? [{ key: "anexos", label: "Anexos" }] : []),
    { key: "certificacoes", label: "Certificações" },
  ];

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel + Toggle */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Search className="h-5 w-5" />
                Fornecedores
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <input type="text" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CPF/CNPJ</label>
                <input type="text" value={filterDocument} onChange={(e) => setFilterDocument(maskCpfCnpj(e.target.value))} placeholder="CPF ou CNPJ" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Selecione...</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
                <input type="text" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex gap-4">
                  {([["ativo", "Ativo"], ["inativo", "Inativo"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterConditionSupplier" checked={filterCondition === val} onChange={() => setFilterCondition(val)} className="accent-primary" />
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
              <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={() => exportToCSV(filtered, tableFields, "suppliers")} className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
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
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <>
                <div className="flex-1 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/50">
                        <th className="w-16 px-4 py-3 font-medium text-muted-foreground">Ativo</th>
                        {tableFields.map((f) => <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground">{f.label}</th>)}
                        <th className="w-24 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedItems.map((item) => (
                        <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${!item.active ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })} className={`relative h-6 w-11 rounded-full transition-colors ${item.active ? "bg-primary" : "bg-muted-foreground/30"}`}>
                              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${item.active ? "translate-x-5" : ""}`} />
                            </button>
                          </td>
                          {tableFields.map((f) => <td key={f.name} className="px-4 py-3 text-foreground">{String(item[f.name] ?? "—")}</td>)}
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
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl flex flex-col" style={{ height: "85vh" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Novo"} fornecedor</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/30">
              {allTabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px text-center ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "dados" && (
                <form id="supplier-form" onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Row 1: Tipo + CNPJ/CPF + IE */}
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-foreground">Tipo</span>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="person_type" checked={(form.person_type || "j") === "j"} onChange={() => setForm(p => ({ ...p, person_type: "j" }))} className="accent-primary" />
                        Pessoa jurídica
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="person_type" checked={form.person_type === "f"} onChange={() => setForm(p => ({ ...p, person_type: "f" }))} className="accent-primary" />
                        Pessoa física
                      </label>
                    </div>
                    <div className="flex items-end gap-2 ml-auto">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">{form.person_type === "f" ? "CPF" : "CNPJ"}</label>
                        <div className="flex items-center gap-1">
                          {renderFormInput({ name: "document", label: "CPF/CNPJ", type: "cpfcnpj" })}
                          <button type="button" disabled={cnpjLoading} onClick={async () => {
                            const doc = (form.document || "").replace(/\D/g, "");
                            if (doc.length !== 14) { toast.error("Informe um CNPJ válido com 14 dígitos"); return; }
                            setCnpjLoading(true);
                            const data = await fetchCnpj(form.document);
                            setCnpjLoading(false);
                            if (data) {
                              setForm(p => ({
                                ...p,
                                name: data.razao_social || p.name,
                                trade_name: data.nome_fantasia || p.trade_name,
                                address: data.logradouro || p.address,
                                address_number: data.numero || p.address_number,
                                complement: data.complemento || p.complement,
                                neighborhood: data.bairro || p.neighborhood,
                                city: data.municipio || p.city,
                                state: data.uf || p.state,
                                cep: data.cep || p.cep,
                                phone: data.telefone || p.phone,
                                email: data.email || p.email,
                              }));
                              toast.success("Dados da empresa preenchidos!");
                            } else {
                              toast.error("CNPJ não encontrado");
                            }
                          }} className="p-2 rounded-lg border border-input hover:bg-muted text-muted-foreground disabled:opacity-50">
                            {cnpjLoading ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> : <Search className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">I.E.</label>
                        <input type="text" value={form.ie || ""} onChange={e => setForm(p => ({ ...p, ie: e.target.value }))} className="w-32 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Razão social + Nome fantasia */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Razão social *</label>
                      <input type="text" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Nome fantasia</label>
                      <input type="text" value={form.trade_name || ""} onChange={e => setForm(p => ({ ...p, trade_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                    </div>
                  </div>

                  {/* Row 3: Observação + Parceiro recomendado */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Observação</label>
                      <textarea value={form.notes || ""} onChange={e => { if (e.target.value.length <= OBS_MAX_LEN) setForm(p => ({ ...p, notes: e.target.value })); }} rows={3} placeholder="Digite uma mensagem..." className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      <p className="text-xs text-muted-foreground text-right mt-1">{(OBS_MAX_LEN - (form.notes?.length || 0)).toLocaleString("pt-BR")} caracteres restantes</p>
                    </div>
                    <div className="flex items-start pt-6">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!form.recommended} onChange={e => setForm(p => ({ ...p, recommended: e.target.checked }))} className="accent-primary h-4 w-4" />
                        Parceiro recomendado (visível no Portal do cliente)
                      </label>
                    </div>
                  </div>

                  {/* Contato fieldset */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Contato</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap w-16 text-right">Telefone</label>
                        <input type="tel" value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">E-mail</label>
                        <input type="email" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap w-16 text-right">Celular</label>
                        <input type="tel" value={form.cellphone || ""} onChange={e => setForm(p => ({ ...p, cellphone: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Site</label>
                        <input type="text" value={form.site || ""} onChange={e => setForm(p => ({ ...p, site: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Localização fieldset */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Localização</legend>
                    <div className="grid grid-cols-[1fr_2fr_1fr] gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">CEP</label>
                        {renderFormInput({ name: "cep", label: "CEP", type: "cep" })}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Logradouro</label>
                        <input type="text" value={form.address || ""} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Número</label>
                        <input type="text" value={form.address_number || ""} onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Complemento</label>
                        <input type="text" value={form.complement || ""} onChange={e => setForm(p => ({ ...p, complement: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Bairro</label>
                        <input type="text" value={form.neighborhood || ""} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">UF</label>
                        <select value={form.state || ""} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                          <option value="">Selecione...</option>
                          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground whitespace-nowrap">Cidade</label>
                        <input type="text" value={form.city || ""} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
                      </div>
                    </div>
                  </fieldset>
                </form>
              )}

              {activeTab === "bancarios" && (
                <div className="p-6 text-center text-muted-foreground py-12">Em breve</div>
              )}
              {activeTab === "vendedores" && (
                <div className="p-6 text-center text-muted-foreground py-12">Em breve</div>
              )}
              {activeTab === "categorias" && (
                <div className="p-6 text-center text-muted-foreground py-12">Em breve</div>
              )}
              {activeTab === "qualidade" && (
                <div className="p-6 text-center text-muted-foreground py-12">Em breve</div>
              )}
              {activeTab === "anexos" && editing && (
                <div className="p-6"><Attachments entityType="suppliers" entityId={editing.id} /></div>
              )}
              {activeTab === "certificacoes" && (
                <div className="p-6 text-center text-muted-foreground py-12">Em breve</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-3 border-t border-border bg-muted rounded-b-xl">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" form="supplier-form" disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {saveMutation.isPending ? "Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <CsvImport
          table="suppliers"
          queryKey="suppliers"
          fields={fields.map(f => ({ name: f.name, label: f.label, type: f.type, required: f.required }))}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
