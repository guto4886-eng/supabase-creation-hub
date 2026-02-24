import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Eraser, Building2
} from "lucide-react";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";
import { fetchCep } from "@/utils/cep";
import Attachments from "@/components/Attachments";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const ALL_TABS = [
  { key: "dados", label: "Dados" },
  { key: "anexos", label: "Anexos" },
];

const PAGE_SIZE = 15;

export default function Companies() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(true);
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

  // Get matrices for the parent_id select
  const matrices = items.filter((i) => i.company_type === "matriz");

  const filtered = searched
    ? items.filter((item) => {
        if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterDocument && !item.document?.includes(filterDocument.replace(/\D/g, ""))) return false;
        if (filterCity && !item.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
        if (filterState && item.state !== filterState) return false;
        if (filterMatrix === "matriz" && item.company_type !== "matriz") return false;
        if (filterMatrix === "filial" && item.company_type !== "filial") return false;
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

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const getParentName = (parentId: string | null) => {
    if (!parentId) return "—";
    const parent = items.find((i) => i.id === parentId);
    return parent?.name || "—";
  };

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden relative">
      {/* Filter Panel */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cadastro de Empresas
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Matriz</label>
                <select value={filterMatrix} onChange={(e) => setFilterMatrix(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  <option value="matriz">Matriz</option>
                  <option value="filial">Filial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CPF/CNPJ</label>
                <input type="text" value={filterDocument} onChange={(e) => setFilterDocument(maskCpfCnpj(e.target.value))} placeholder="CPF ou CNPJ" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cidade-UF</label>
                <div className="flex gap-2">
                  <input type="text" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} placeholder="Cidade" className={inputClass} />
                  <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={`${inputClass} w-20 flex-shrink-0`}>
                    <option value="">UF</option>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value as any)} className={inputClass}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="ambos">Ambos</option>
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
                <h3 className="text-xl font-semibold text-foreground mb-2">Inclua uma nova empresa!</h3>
                <p className="text-sm text-muted-foreground mb-4">Cadastre matriz ou filiais.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
                  Incluir Novo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              </h3>
              <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="h-4 w-4" /> Novo
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
                        {fields.map((f) => (
                          <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground relative select-none" style={{ width: colWidths[f.name] || 120 }}>
                            {f.label}
                            <span
                              onMouseDown={(e) => onResizeStart(f.name, e)}
                              className="absolute right-0 top-1 bottom-1 w-1 rounded-full bg-muted-foreground/30 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                            />
                          </th>
                        ))}
                        <th className="px-4 py-3" style={{ width: 80 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, idx) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`transition-colors cursor-pointer ${!item.active ? "opacity-50" : ""} ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-primary/5`}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })}
                              className={`relative w-14 h-7 rounded-full transition-colors duration-500 ease-in-out ${item.active ? "bg-blue-500" : "bg-orange-500"}`}
                              style={{ minWidth: 56 }}
                            >
                              <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-lg transition-[left] duration-500 ease-in-out" style={{ left: item.active ? 29 : 3 }} />
                            </button>
                          </td>
                          {fields.map((f) => {
                            let display = item[f.name] ?? "—";
                            if (f.name === "company_type") display = item[f.name] === "matriz" ? "Matriz" : "Filial";
                            return <td key={f.name} className="px-4 py-3 text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={String(display)}>{String(display)}</td>;
                          })}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-blue-100 text-blue-500 hover:text-blue-700" title="Editar"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-red-100 text-red-500 hover:text-red-700" title="Remover"><Trash2 className="h-4 w-4" /></button>
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

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                  {/* Tipo */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Tipo *</label>
                    <div className="flex gap-4">
                      {([["matriz", "Matriz"], ["filial", "Filial"]] as const).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                          <input type="radio" name="company_type" checked={form.company_type === val} onChange={() => setForm((p) => ({ ...p, company_type: val, parent_id: val === "matriz" ? null : p.parent_id }))} className="accent-primary" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Matriz (parent) - only for filial */}
                  {form.company_type === "filial" && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Matriz *</label>
                      <select
                        value={form.parent_id ?? ""}
                        onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value || null }))}
                        required
                        className={inputClass}
                      >
                        <option value="">Selecione a matriz...</option>
                        {matrices.filter((m) => m.id !== editing?.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Nome */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Razão Social *</label>
                    <input value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} />
                  </div>

                  {/* Trade name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Nome Fantasia</label>
                    <input value={form.trade_name ?? ""} onChange={(e) => setForm((p) => ({ ...p, trade_name: e.target.value }))} className={inputClass} />
                  </div>

                  {/* CNPJ + IE */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">CNPJ</label>
                      <input
                        value={form.document ?? ""}
                        onChange={(e) => setForm((p) => ({ ...p, document: maskCpfCnpj(e.target.value) }))}
                        placeholder="00.000.000/0000-00"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[40px] text-right">IE</label>
                      <input value={form.ie ?? ""} onChange={(e) => setForm((p) => ({ ...p, ie: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Email + Phone + Cellphone */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Email</label>
                      <input type="email" value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Telefone</label>
                      <input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Celular</label>
                      <input value={form.cellphone ?? ""} onChange={(e) => setForm((p) => ({ ...p, cellphone: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* CEP */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">CEP</label>
                    <div className="relative flex-1">
                      <input
                        value={form.cep ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                          const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                          setForm((p) => ({ ...p, cep: formatted }));
                        }}
                        onBlur={(e) => handleCepBlur(e.target.value)}
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

                  {/* Address */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Endereço</label>
                    <input value={form.address ?? ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className={inputClass} />
                  </div>

                  {/* Number + Complement + Neighborhood */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Número</label>
                      <input value={form.address_number ?? ""} onChange={(e) => setForm((p) => ({ ...p, address_number: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[90px] text-right">Complemento</label>
                      <input value={form.complement ?? ""} onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[60px] text-right">Bairro</label>
                      <input value={form.neighborhood ?? ""} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* City + State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right">Cidade</label>
                      <input value={form.city ?? ""} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[40px] text-right">UF</label>
                      <select value={form.state ?? ""} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="flex items-start gap-3">
                    <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[120px] text-right pt-2">Observações</label>
                    <textarea value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className={inputClass} />
                  </div>
                </form>
              )}

              {activeTab === "anexos" && editing && (
                <div className="p-5">
                  <Attachments entityType="companies" entityId={editing.id} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-3 border-t border-border bg-muted rounded-b-xl">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-white text-foreground hover:bg-muted">Cancelar</button>
              {activeTab === "dados" && (
                <button type="submit" form="company-form" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
