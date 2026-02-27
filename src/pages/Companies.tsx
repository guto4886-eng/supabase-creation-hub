import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Eraser, Building2,
  ChevronDown, Settings, Mail, CalendarDays, ShieldCheck, FileText, Upload, Eye, Save
} from "lucide-react";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";
import { fetchCep } from "@/utils/cep";
import { fetchCnpj } from "@/utils/cnpjLookup";
import Attachments from "@/components/Attachments";
import ImageCropper from "@/components/ImageCropper";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const ALL_TABS = [
  { key: "dados", label: "Dados" },
  { key: "anexos", label: "Anexos" },
];

const PAGE_SIZE = 15;

type ConfigSection = "matriz_filiais" | "modelos_emails" | "feriados" | "alcadas" | "relatorios" | null;

const CONFIG_MENU = [
  {
    key: "empresa",
    label: "Empresa",
    icon: Building2,
    children: [
      { key: "matriz_filiais" as ConfigSection, label: "Matriz / Filiais" },
      { key: "modelos_emails" as ConfigSection, label: "Modelos de Emails" },
      { key: "feriados" as ConfigSection, label: "Feriados" },
      { key: "alcadas" as ConfigSection, label: "Alçadas de Aprovação" },
      { key: "relatorios" as ConfigSection, label: "Relatórios - Papel Timbrado" },
    ],
  },
];

export default function Companies() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ empresa: true });
  const [activeSection, setActiveSection] = useState<ConfigSection>("matriz_filiais");

  // Filters (for matriz_filiais)
  const [filterName, setFilterName] = useState("");
  const [filterDocument, setFilterDocument] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterMatrix, setFilterMatrix] = useState("");
  const [filterCondition, setFilterCondition] = useState<"ativo" | "inativo" | "ambos">("ativo");
  const [searched, setSearched] = useState(false);

  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  // Resizable columns
  const defaultWidths: Record<string, number> = { name: 200, company_type: 100, document: 160, city: 140, state: 60 };
  const [colWidths, setColWidths] = useState<Record<string, number>>(defaultWidths);
  const resizing = useRef<{ field: string; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((field: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { field, startX: e.clientX, startW: colWidths[field] || 120 };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const diff = ev.clientX - resizing.current.startX;
      const newW = Math.max(60, resizing.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [resizing.current!.field]: newW }));
    };
    const onUp = () => {
      resizing.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("company_type", { ascending: true }).order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const matrices = items.filter((i) => i.company_type === "matriz");

  const filtered = items.filter((item) => {
    if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterDocument && !item.document?.includes(filterDocument.replace(/\D/g, ""))) return false;
    if (filterCity && !item.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterState && item.state !== filterState) return false;
    if (filterMatrix === "matriz" && item.company_type !== "matriz") return false;
    if (filterMatrix === "filial" && item.company_type !== "filial") return false;
    if (filterCondition === "ativo" && !item.active) return false;
    if (filterCondition === "inativo" && item.active) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("companies").update(values as any).eq("id", editing.id);
        if (error) throw error;
        return { ...editing, ...values };
      } else {
        const { data, error } = await supabase.from("companies").insert({ ...values, user_id: user!.id } as any).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (saved: any) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(editing ? "Atualizado!" : "Empresa criada!");
      setEditing(saved);
      setForm({ ...saved });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("companies").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fields = [
    { name: "name", label: "Nome" },
    { name: "company_type", label: "Tipo" },
    { name: "document", label: "CPF/CNPJ" },
    { name: "city", label: "Cidade" },
    { name: "state", label: "UF" },
  ];

  const openNew = () => {
    setEditing(null);
    setForm({ company_type: "matriz" });
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
    const { id, created_at, updated_at, user_id, ...values } = form;
    saveMutation.mutate(values);
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

  const handleCnpjBlur = async (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    const data = await fetchCnpj(value);
    setCnpjLoading(false);
    if (data) {
      setForm((p: any) => ({
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
      toast.success("Dados do CNPJ preenchidos!");
    } else {
      toast.error("CNPJ não encontrado");
    }
  };

  const handleSearch = () => {
    setSearched(true);
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilterName("");
    setFilterDocument("");
    setFilterCity("");
    setFilterState("");
    setFilterMatrix("");
    setFilterCondition("ativo");
    setSearched(false);
    setPage(0);
  };

  const toggleMenu = (key: string) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const sectionLabels: Record<string, string> = {
    matriz_filiais: "Matriz / Filiais",
    modelos_emails: "Modelos de Emails",
    feriados: "Feriados",
    alcadas: "Alçadas de Aprovação",
    relatorios: "Relatórios - Papel Timbrado",
  };

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden relative">
      {/* Config Sidebar */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-72" : "w-0"}`}>
          <div className="flex flex-col h-full w-72">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-primary uppercase">Configurações</h2>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {CONFIG_MENU.map((menu) => {
                const expanded = expandedMenus[menu.key] ?? false;
                const Icon = menu.icon;
                const hasActiveChild = menu.children.some((c) => c.key === activeSection);
                return (
                  <div key={menu.key}>
                    <button
                      onClick={() => toggleMenu(menu.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        hasActiveChild
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/80 text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
                      <Icon className="h-4 w-4" />
                      {menu.label}
                    </button>
                    {expanded && (
                      <div className="ml-4 mt-1 space-y-0.5 pl-3 border-l-2 border-primary/20">
                        {menu.children.map((child) => (
                          <button
                            key={child.key}
                            onClick={() => setActiveSection(child.key)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              activeSection === child.key
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-foreground/70 hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="flex-shrink-0 relative z-10" style={{ width: "28px" }}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sidebarOpen ? "bg-primary" : "bg-amber-700"}`} />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${sidebarOpen ? "bg-primary" : "bg-amber-700"}`}
            title={sidebarOpen ? "Fechar menu" : "Configurações"}
          >
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1" style={{ writingMode: "vertical-lr" }}>
              CONFIGURAÇÕES {sidebarOpen ? "‹" : "›"}
            </span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSection === "matriz_filiais" && (
          <MatrizFiliaisContent
            items={items}
            isLoading={isLoading}
            filtered={filtered}
            
            paginatedItems={paginatedItems}
            totalPages={totalPages}
            currentPage={currentPage}
            page={page}
            setPage={setPage}
            fields={fields}
            colWidths={colWidths}
            onResizeStart={onResizeStart}
            openNew={openNew}
            openEdit={openEdit}
            deleteMutation={deleteMutation}
            toggleActive={toggleActive}
            filterName={filterName}
            setFilterName={setFilterName}
            filterDocument={filterDocument}
            setFilterDocument={setFilterDocument}
            filterCity={filterCity}
            setFilterCity={setFilterCity}
            filterState={filterState}
            setFilterState={setFilterState}
            filterMatrix={filterMatrix}
            setFilterMatrix={setFilterMatrix}
            filterCondition={filterCondition}
            setFilterCondition={setFilterCondition}
            handleSearch={handleSearch}
            handleClearFilters={handleClearFilters}
            setSidebarOpen={setSidebarOpen}
          />
        )}

        {activeSection === "feriados" && <HolidaysContent user={user} />}

        {activeSection === "relatorios" && <LetterheadContent user={user} />}

        {activeSection && !["matriz_filiais", "feriados", "relatorios"].includes(activeSection) && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Settings className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{sectionLabels[activeSection]}</h3>
              <p className="text-sm text-muted-foreground">Em breve disponível.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <CompanyFormModal
          editing={editing}
          form={form}
          setForm={setForm}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          matrices={matrices}
          cepLoading={cepLoading}
          cnpjLoading={cnpjLoading}
          handleSubmit={handleSubmit}
          handleCepBlur={handleCepBlur}
          handleCnpjBlur={handleCnpjBlur}
          closeForm={closeForm}
          saveMutation={saveMutation}
          inputClass={inputClass}
        />
      )}
    </div>
  );
}

/* ───── Matriz/Filiais content ───── */
function MatrizFiliaisContent({
  items, isLoading, filtered, paginatedItems, totalPages, currentPage, page, setPage,
  fields, colWidths, onResizeStart, openNew, openEdit, deleteMutation, toggleActive,
  filterName, setFilterName, filterDocument, setFilterDocument, filterCity, setFilterCity,
  filterState, setFilterState, filterMatrix, setFilterMatrix, filterCondition, setFilterCondition,
  handleSearch, handleClearFilters, setSidebarOpen,
}: any) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Search filter sub-panel */}
      <div className={`bg-card border-r border-border transition-all duration-300 overflow-hidden ${filtersOpen ? "w-72" : "w-0"}`}>
        <div className="flex flex-col h-full w-72">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtros de Pesquisa
            </h3>
            <button onClick={() => setFiltersOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
              <input type="text" value={filterName} onChange={(e: any) => setFilterName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
              <select value={filterMatrix} onChange={(e: any) => setFilterMatrix(e.target.value)} className={inputClass}>
                <option value="">Todos</option>
                <option value="matriz">Matriz</option>
                <option value="filial">Filial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">CPF/CNPJ</label>
              <input type="text" value={filterDocument} onChange={(e: any) => setFilterDocument(maskCpfCnpj(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cidade-UF</label>
              <div className="flex gap-2">
                <input type="text" value={filterCity} onChange={(e: any) => setFilterCity(e.target.value)} placeholder="Cidade" className={inputClass} />
                <select value={filterState} onChange={(e: any) => setFilterState(e.target.value)} className={`${inputClass} w-20 flex-shrink-0`}>
                  <option value="">UF</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Condição</label>
              <select value={filterCondition} onChange={(e: any) => setFilterCondition(e.target.value)} className={inputClass}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>
          <div className="p-4 border-t border-border flex gap-2">
            <button onClick={handleClearFilters} className="flex-1 flex items-center justify-center px-3 py-2.5 rounded-lg bg-background border border-border text-muted-foreground hover:bg-muted transition-colors" title="Limpar filtros">
              <Eraser className="h-5 w-5" />
            </button>
            <button onClick={() => { handleSearch(); setFiltersOpen(false); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              <Search className="h-4 w-4" /> Pesquisar
            </button>
          </div>
        </div>
      </div>

      {/* Main listing */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {filtered.length} empresa{filtered.length !== 1 ? "s" : ""}
            </h3>
            <button onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent">
              <Search className="h-4 w-4" /> Filtros
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <>
              <div className="flex-1 overflow-auto border border-border rounded-xl">
                <table className="text-sm" style={{ tableLayout: "fixed", minWidth: 800 }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted">
                      <th className="px-4 py-3 font-medium text-muted-foreground" style={{ width: 80 }}>Ativo</th>
                      {fields.map((f: any) => (
                        <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground relative select-none" style={{ width: colWidths[f.name] || 120 }}>
                          {f.label}
                          <span
                            onMouseDown={(e: any) => onResizeStart(f.name, e)}
                            className="absolute right-0 top-1 bottom-1 w-1 rounded-full bg-muted-foreground/30 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                          />
                        </th>
                      ))}
                      <th className="px-4 py-3" style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item: any, idx: number) => (
                      <tr key={item.id} onClick={() => openEdit(item)} className={`transition-colors cursor-pointer ${!item.active ? "opacity-50" : ""} ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-primary/5`}>
                        <td className="px-4 py-3" onClick={(e: any) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-500 ease-in-out ${item.active ? "bg-primary" : "bg-destructive"}`}
                            style={{ minWidth: 56 }}
                          >
                            <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-lg transition-[left] duration-500 ease-in-out" style={{ left: item.active ? 29 : 3 }} />
                          </button>
                        </td>
                        {fields.map((f: any) => {
                          let display = item[f.name] ?? "—";
                          if (f.name === "company_type") display = item[f.name] === "matriz" ? "Matriz" : "Filial";
                          return <td key={f.name} className="px-4 py-3 text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={String(display)}>{String(display)}</td>;
                        })}
                        <td className="px-4 py-3" onClick={(e: any) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-accent text-primary hover:text-primary" title="Editar"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-accent text-destructive hover:text-destructive" title="Remover"><Trash2 className="h-4 w-4" /></button>
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
                    <button onClick={() => setPage((p: number) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-md text-sm font-medium ${i === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"}`}>{i + 1}</button>
                    )).slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3))}
                    <button onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Floating button */}
        <button
          onClick={openNew}
          className="absolute bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full shadow-lg font-medium hover:opacity-90 transition-opacity text-sm uppercase tracking-wide"
        >
          <Plus className="h-5 w-5" /> Incluir Novo
        </button>
      </div>
    </div>
  );
}

/* ───── Company Form Modal ───── */
function CompanyFormModal({
  editing, form, setForm, activeTab, setActiveTab, matrices, cepLoading, cnpjLoading,
  handleSubmit, handleCepBlur, handleCnpjBlur, closeForm, saveMutation, inputClass,
}: any) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedLogo = async (blob: Blob) => {
    if (!editing?.id) return;
    setCropperSrc(null);
    setUploadingLogo(true);
    try {
      const path = `companies/${editing.id}/logo.jpg`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) { toast.error("Erro ao enviar logomarca"); setUploadingLogo(false); return; }
      const { data: publicUrl } = supabase.storage.from("attachments").getPublicUrl(path);
      const logoUrl = publicUrl.publicUrl + "?t=" + Date.now();
      await supabase.from("companies").update({ logo_url: logoUrl } as any).eq("id", editing.id);
      setForm((p: any) => ({ ...p, logo_url: logoUrl }));
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Logomarca atualizada!");
    } catch (error) {
      console.error("Erro ao salvar logomarca:", error);
      toast.error("Erro inesperado ao salvar logomarca");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!editing?.id) return;
    try {
      await supabase.from("companies").update({ logo_url: null } as any).eq("id", editing.id);
      setForm((p: any) => ({ ...p, logo_url: null }));
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Logomarca removida!");
    } catch (error) {
      toast.error("Erro inesperado");
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e: any) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted rounded-t-xl">
          <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Nova"} empresa</h3>
          <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {editing && (
          <div className="grid grid-cols-2 bg-muted border-b border-border">
            {ALL_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px text-center ${
                  activeTab === t.key
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeTab === "dados" && (
            <form id="company-form" onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Logomarca */}
              {editing && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Logomarca</label>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                        {form.logo_url ? (
                          <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 shadow-sm">
                        <Upload className="h-3.5 w-3.5" />
                        <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                      </label>
                    </div>
                    <div className="space-y-1">
                      {uploadingLogo && <p className="text-xs text-muted-foreground">Enviando...</p>}
                      {form.logo_url && (
                        <button type="button" onClick={handleRemoveLogo} className="text-xs text-destructive hover:underline">Remover logomarca</button>
                      )}
                      {!form.logo_url && !uploadingLogo && (
                        <p className="text-xs text-muted-foreground">Clique no ícone para enviar</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Tipo *</label>
                <div className="flex gap-4">
                  {([["matriz", "Matriz"], ["filial", "Filial"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="company_type" checked={form.company_type === val} onChange={() => setForm((p: any) => ({ ...p, company_type: val, parent_id: val === "matriz" ? null : p.parent_id }))} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {form.company_type === "filial" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Matriz *</label>
                  <select value={form.parent_id ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, parent_id: e.target.value || null }))} required className={inputClass}>
                    <option value="">Selecione a matriz...</option>
                    {matrices.filter((m: any) => m.id !== editing?.id).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Razão Social *</label>
                <input value={form.name ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, name: e.target.value }))} required className={inputClass} />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Nome Fantasia</label>
                <input value={form.trade_name ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, trade_name: e.target.value }))} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">CNPJ</label>
                  <div className="relative flex-1">
                    <input value={form.document ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, document: maskCpfCnpj(e.target.value) }))} onBlur={(e: any) => handleCnpjBlur(e.target.value)} placeholder="00.000.000/0000-00" className={inputClass} />
                    {cnpjLoading && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[40px] text-right">IE</label>
                  <input value={form.ie ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, ie: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Email</label>
                  <input type="email" value={form.email ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, email: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Telefone</label>
                  <input value={form.phone ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Celular</label>
                  <input value={form.cellphone ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, cellphone: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">CEP</label>
                <div className="relative flex-1">
                  <input
                    value={form.cep ?? ""}
                    onChange={(e: any) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                      setForm((p: any) => ({ ...p, cep: formatted }));
                    }}
                    onBlur={(e: any) => handleCepBlur(e.target.value)}
                    placeholder="00000-000"
                    className={inputClass}
                  />
                  {cepLoading && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Endereço</label>
                <input value={form.address ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, address: e.target.value }))} className={inputClass} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Número</label>
                  <input value={form.address_number ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, address_number: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[90px] text-right">Complemento</label>
                  <input value={form.complement ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, complement: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Bairro</label>
                  <input value={form.neighborhood ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Cidade</label>
                  <input value={form.city ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, city: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[40px] text-right">UF</label>
                  <select value={form.state ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, state: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right pt-2">Observações</label>
                <textarea value={form.notes ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={3} className={inputClass} />
              </div>
            </form>
          )}

          {activeTab === "anexos" && editing && (
            <div className="p-5">
              <Attachments entityType="companies" entityId={editing.id} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-3 border-t border-border bg-muted rounded-b-xl">
          <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
          {activeTab === "dados" && (
            <button type="submit" form="company-form" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      </div>
      {cropperSrc && (
        <ImageCropper imageSrc={cropperSrc} aspectRatio={1} onCrop={handleCroppedLogo} onClose={() => setCropperSrc(null)} />
      )}
    </div>
  );
}

/* ───── Federal Holidays ───── */
const FEDERAL_HOLIDAYS = [
  { name: "Confraternização Universal", date: "01-01" },
  { name: "Carnaval", date: "03-04" },
  { name: "Sexta-feira Santa", date: "04-18" },
  { name: "Tiradentes", date: "04-21" },
  { name: "Dia do Trabalho", date: "05-01" },
  { name: "Corpus Christi", date: "06-19" },
  { name: "Independência do Brasil", date: "09-07" },
  { name: "Nossa Senhora Aparecida", date: "10-12" },
  { name: "Finados", date: "11-02" },
  { name: "Proclamação da República", date: "11-15" },
  { name: "Consciência Negra", date: "11-20" },
  { name: "Natal", date: "12-25" },
];

function HolidaysContent({ user }: { user: any }) {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays").select("*").order("holiday_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const existing = holidays.map((h: any) => `${h.name}|${h.holiday_date}`);
      const toInsert = FEDERAL_HOLIDAYS
        .map((h) => ({
          user_id: user!.id,
          name: h.name,
          holiday_date: `${year}-${h.date}`,
          type: "federal",
          active: true,
        }))
        .filter((h) => !existing.includes(`${h.name}|${h.holiday_date}`));
      if (toInsert.length === 0) {
        toast.info("Feriados deste ano já estão cadastrados.");
        return;
      }
      const { error } = await supabase.from("holidays").insert(toInsert as any);
      if (error) throw error;
      toast.success(`${toInsert.length} feriado(s) adicionados para ${year}!`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Feriado removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("holidays").update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredByYear = holidays.filter((h: any) => h.holiday_date?.startsWith(String(year)));

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Feriados</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setYear((y) => y - 1)} className="px-2 py-1 rounded border border-border hover:bg-accent text-sm">&lt;</button>
            <span className="text-sm font-medium text-foreground w-12 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="px-2 py-1 rounded border border-border hover:bg-accent text-sm">&gt;</button>
          </div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <CalendarDays className="h-4 w-4" />
            {seedMutation.isPending ? "Adicionando..." : `Gerar Feriados ${year}`}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filteredByYear.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum feriado cadastrado para {year}. Clique em "Gerar Feriados" para adicionar os feriados federais.
        </div>
      ) : (
        <div className="flex-1 overflow-auto border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted">
                <th className="px-4 py-3 font-medium text-muted-foreground text-left" style={{ width: 80 }}>Ativo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-left">Data</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-left">Nome</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-left" style={{ width: 100 }}>Tipo</th>
                <th className="px-4 py-3" style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {filteredByYear.map((h: any, idx: number) => {
                const d = new Date(h.holiday_date + "T12:00:00");
                const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
                return (
                  <tr key={h.id} className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/30"} ${!h.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive.mutate({ id: h.id, active: !h.active })}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-500 ${h.active ? "bg-primary" : "bg-destructive"}`}
                        style={{ minWidth: 56 }}
                      >
                        <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-lg transition-[left] duration-500" style={{ left: h.active ? 29 : 3 }} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground">{dateStr} <span className="text-muted-foreground capitalize">({weekday})</span></td>
                    <td className="px-4 py-3 text-foreground font-medium">{h.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{h.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm("Remover feriado?")) deleteMutation.mutate(h.id); }} className="p-1.5 rounded-md hover:bg-accent text-destructive" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Letterhead / Papel Timbrado ───── */
const IMAGE_MODES = ["Tamanho original", "Esticar", "Ajustar"];
const ALIGN_H = ["Esquerda", "Centro", "Direita"];
const ALIGN_V = ["Topo", "Meio", "Base"];
const OPACITY_OPTIONS = ["0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"];
const TEXT_DIRECTIONS = ["Horizontal", "Vertical"];
const TEXT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

function LetterheadContent({ user }: { user: any }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load companies for selection
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, company_type").eq("active", true).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [form, setForm] = useState<Record<string, any>>({
    image_mode: "Tamanho original",
    image_fill: false,
    image_align_h: "Centro",
    image_align_v: "Meio",
    image_opacity: "0%",
    image_url: "",
    text_message: "",
    text_direction: "Horizontal",
    text_size: 8,
    text_bold: false,
    text_italic: false,
    text_opacity: "0%",
    text_color: "#000000",
  });
  const [configId, setConfigId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load config for selected company
  const { isLoading } = useQuery({
    queryKey: ["letterhead", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const { data, error } = await supabase.from("letterhead_configs").select("*").eq("company_id", selectedCompanyId).maybeSingle();
      if (error) throw error;
      if (data) {
        setConfigId(data.id);
        setForm({
          image_mode: data.image_mode || "Tamanho original",
          image_fill: data.image_fill || false,
          image_align_h: data.image_align_h || "Centro",
          image_align_v: data.image_align_v || "Meio",
          image_opacity: `${data.image_opacity || 0}%`,
          image_url: data.image_url || "",
          text_message: data.text_message || "",
          text_direction: data.text_direction || "Horizontal",
          text_size: data.text_size || 8,
          text_bold: data.text_bold || false,
          text_italic: data.text_italic || false,
          text_opacity: `${data.text_opacity || 0}%`,
          text_color: data.text_color || "#000000",
        });
      } else {
        setConfigId(null);
        setForm({
          image_mode: "Tamanho original", image_fill: false, image_align_h: "Centro", image_align_v: "Meio",
          image_opacity: "0%", image_url: "", text_message: "", text_direction: "Horizontal", text_size: 8,
          text_bold: false, text_italic: false, text_opacity: "0%", text_color: "#000000",
        });
      }
      return data;
    },
    enabled: !!selectedCompanyId,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;
    setUploading(true);
    const path = `${user.id}/letterhead/${selectedCompanyId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) { toast.error("Erro ao enviar imagem"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    setForm((p: any) => ({ ...p, image_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        company_id: selectedCompanyId,
        image_mode: form.image_mode,
        image_fill: form.image_fill,
        image_align_h: form.image_align_h,
        image_align_v: form.image_align_v,
        image_opacity: parseInt(form.image_opacity) || 0,
        image_url: form.image_url,
        text_message: form.text_message,
        text_direction: form.text_direction,
        text_size: form.text_size,
        text_bold: form.text_bold,
        text_italic: form.text_italic,
        text_opacity: parseInt(form.text_opacity) || 0,
        text_color: form.text_color,
      };
      if (configId) {
        const { error } = await supabase.from("letterhead_configs").update(payload as any).eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("letterhead_configs").insert(payload as any).select().single();
        if (error) throw error;
        setConfigId(data.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["letterhead", selectedCompanyId] });
      toast.success("Configuração salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const labelClass = "text-sm font-medium text-foreground whitespace-nowrap min-w-[130px] text-right";

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Relatórios - Papel Timbrado</h3>
      </div>

      {/* Company selector */}
      <div className="flex items-center gap-3 mb-6">
        <label className={labelClass}>Empresa</label>
        <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className={inputClass + " max-w-md"}>
          <option value="">Selecione uma empresa...</option>
          {companies.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name} ({c.company_type === "matriz" ? "Matriz" : "Filial"})</option>
          ))}
        </select>
      </div>

      {!selectedCompanyId ? (
        <div className="text-center py-12 text-muted-foreground">Selecione uma empresa para configurar o papel timbrado.</div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Image section */}
          <fieldset className="border border-border rounded-lg p-4">
            <legend className="text-sm font-semibold text-foreground px-2">Imagem</legend>
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 flex-1">
                  <label className={labelClass}>Modo</label>
                  <select value={form.image_mode} onChange={(e) => setForm((p: any) => ({ ...p, image_mode: e.target.value }))} className={inputClass}>
                    {IMAGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.image_fill} onChange={(e) => setForm((p: any) => ({ ...p, image_fill: e.target.checked }))} className="accent-primary h-4 w-4" />
                  Preencher
                </label>
                {/* Image preview/upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden flex-shrink-0"
                >
                  {uploading ? (
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  ) : form.image_url ? (
                    <img src={form.image_url} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 flex-1">
                  <label className={labelClass}>Alinhamento Horiz.</label>
                  <select value={form.image_align_h} onChange={(e) => setForm((p: any) => ({ ...p, image_align_h: e.target.value }))} className={inputClass}>
                    {ALIGN_H.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <label className={labelClass}>Alinhamento Vert.</label>
                  <select value={form.image_align_v} onChange={(e) => setForm((p: any) => ({ ...p, image_align_v: e.target.value }))} className={inputClass}>
                    {ALIGN_V.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3" style={{ maxWidth: 300 }}>
                <label className={labelClass}>Transparência img.</label>
                <select value={form.image_opacity} onChange={(e) => setForm((p: any) => ({ ...p, image_opacity: e.target.value }))} className={inputClass}>
                  {OPACITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Text section */}
          <fieldset className="border border-border rounded-lg p-4">
            <legend className="text-sm font-semibold text-foreground px-2">Texto</legend>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className={labelClass}>Mensagem</label>
                <input value={form.text_message} onChange={(e) => setForm((p: any) => ({ ...p, text_message: e.target.value }))} className={inputClass} />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 flex-1">
                  <label className={labelClass}>Direção do texto</label>
                  <select value={form.text_direction} onChange={(e) => setForm((p: any) => ({ ...p, text_direction: e.target.value }))} className={inputClass}>
                    {TEXT_DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <label className={labelClass}>Tamanho</label>
                  <select value={form.text_size} onChange={(e) => setForm((p: any) => ({ ...p, text_size: parseInt(e.target.value) }))} className={inputClass}>
                    {TEXT_SIZES.map((s) => <option key={s} value={s}>{s} px</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-w-[160px]">
                  <span className={labelClass}>Negrito</span>
                  <input type="checkbox" checked={form.text_bold} onChange={(e) => setForm((p: any) => ({ ...p, text_bold: e.target.checked }))} className="accent-primary h-4 w-4" />
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-w-[160px]">
                  <span className={labelClass}>Itálico</span>
                  <input type="checkbox" checked={form.text_italic} onChange={(e) => setForm((p: any) => ({ ...p, text_italic: e.target.checked }))} className="accent-primary h-4 w-4" />
                </label>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 flex-1" style={{ maxWidth: 300 }}>
                  <label className={labelClass}>Transparência txt.</label>
                  <select value={form.text_opacity} onChange={(e) => setForm((p: any) => ({ ...p, text_opacity: e.target.value }))} className={inputClass}>
                    {OPACITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Cor</label>
                  <input type="color" value={form.text_color} onChange={(e) => setForm((p: any) => ({ ...p, text_color: e.target.value }))} className="h-10 w-24 rounded border border-input cursor-pointer" />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Preview */}
          {showPreview && (
            <fieldset className="border border-border rounded-lg p-4">
              <legend className="text-sm font-semibold text-foreground px-2">Pré-visualização</legend>
              <div className="bg-white border border-border rounded-lg p-8 min-h-[200px] flex items-center justify-center relative overflow-hidden">
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="Papel timbrado"
                    className="absolute inset-0 w-full h-full"
                    style={{
                      objectFit: form.image_fill ? "cover" : form.image_mode === "Esticar" ? "fill" : "contain",
                      objectPosition: `${form.image_align_h === "Esquerda" ? "left" : form.image_align_h === "Direita" ? "right" : "center"} ${form.image_align_v === "Topo" ? "top" : form.image_align_v === "Base" ? "bottom" : "center"}`,
                      opacity: 1 - (parseInt(form.image_opacity) || 0) / 100,
                    }}
                  />
                )}
                {form.text_message && (
                  <span
                    className="relative z-10"
                    style={{
                      fontSize: `${form.text_size}px`,
                      fontWeight: form.text_bold ? "bold" : "normal",
                      fontStyle: form.text_italic ? "italic" : "normal",
                      color: form.text_color,
                      opacity: 1 - (parseInt(form.text_opacity) || 0) / 100,
                      writingMode: form.text_direction === "Vertical" ? "vertical-rl" : "horizontal-tb",
                    }}
                  >
                    {form.text_message}
                  </span>
                )}
                {!form.image_url && !form.text_message && (
                  <span className="text-muted-foreground text-sm">Configure imagem e/ou texto acima</span>
                )}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* Footer */}
      {selectedCompanyId && (
        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <button onClick={() => setShowPreview((p) => !p)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent text-primary">
            <Eye className="h-4 w-4" /> Visualizar
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}
