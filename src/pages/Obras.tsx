import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Eraser
} from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { fetchCep } from "@/utils/cep";
import Attachments from "@/components/Attachments";

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

const PAGE_SIZE = 15;

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
  const [searched, setSearched] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Form / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);

  // Data
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

  const fields = useMemo(() => [
    { name: "name", label: "Nome da Obra", required: true },
    { name: "client_id", label: "Cliente", type: "select" as const, options: clients.map((c) => ({ value: c.id, label: c.name })) },
    { name: "status", label: "Status", type: "select" as const, options: STATUS_OPTIONS },
    { name: "cep", label: "CEP", type: "cep" as const, hideInTable: true },
    { name: "city", label: "Cidade" },
    { name: "state", label: "UF" },
    { name: "start_date", label: "Início", type: "date" as const },
    { name: "expected_end_date", label: "Previsão término", type: "date" as const },
    { name: "total_budget", label: "Orçamento total", type: "number" as const, hideInTable: true },
    { name: "address", label: "Endereço", hideInTable: true },
    { name: "description", label: "Descrição", type: "textarea" as const, hideInTable: true },
    { name: "notes", label: "Observações", type: "textarea" as const, hideInTable: true },
  ], [clients]);

  const tableFields = fields.filter((f) => !f.hideInTable);

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

  const defaultValues: Record<string, any> = { status: "planejamento" };

  const openNew = () => {
    setEditing(null);
    const initial: Record<string, any> = {};
    fields.forEach((f) => (initial[f.name] = defaultValues[f.name] ?? ""));
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
    setFilterName("");
    setFilterClient("");
    setFilterStatuses([]);
    setFilterCategory("");
    setFilterState("");
    setFilterCity("");
    setFilterNeighborhood("");
    setFilterAddress("");
    setFilterCondition("ativo");
    setFilterStock("ambos");
    setSearched(false);
    setPage(0);
  };

  const getClientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  const renderFormInput = (f: typeof fields[0]) => {
    const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
    if (f.type === "textarea") {
      return <textarea value={form[f.name] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} required={f.required} rows={3} className={inputClass} />;
    }
    if (f.type === "select") {
      return (
        <select value={form[f.name] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} required={f.required} className={inputClass}>
          <option value="">Selecione...</option>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === "cep") {
      return (
        <div className="relative">
          <input type="text" value={form[f.name] ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v; setForm((p) => ({ ...p, [f.name]: formatted })); }} onBlur={(e) => handleCepBlur(e.target.value)} placeholder="00000-000" className={inputClass} />
          {cepLoading && <div className="absolute right-3 top-2.5"><div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /></div>}
        </div>
      );
    }
    return <input type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} required={f.required} step={f.type === "number" ? "0.01" : undefined} className={inputClass} />;
  };

  const allTabs = [
    { key: "dados", label: "Dados" },
    ...(editing ? [{ key: "anexos", label: "Anexos" }] : []),
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
                Obras
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Nome (obra) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome (obra)</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cliente</label>
                <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Selecione...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Situação - checkboxes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Situação</label>
                <div className="space-y-1.5">
                  {STATUS_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterStatuses.includes(o.value)}
                        onChange={(e) => {
                          if (e.target.checked) setFilterStatuses((p) => [...p, o.value]);
                          else setFilterStatuses((p) => p.filter((v) => v !== o.value));
                        }}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Selecione...</option>
                  {CATEGORIA_OBRAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                  <option value="">Selecione...</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
                <input type="text" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Bairro</label>
                <input type="text" value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>

              {/* Logradouro */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Logradouro</label>
                <input type="text" value={filterAddress} onChange={(e) => setFilterAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
              </div>

              {/* Condição */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex gap-4">
                  {([["ativo", "Ativo"], ["inativo", "Inativo"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterConditionObras" checked={filterCondition === val} onChange={() => setFilterCondition(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Controla estoque */}
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

            {/* Filter actions */}
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
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              </h3>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={() => exportToCSV(filtered, tableFields, "obras")} className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
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
                        {tableFields.map((f) => (
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
                          {tableFields.map((f) => {
                            let display: string = item[f.name] ?? "—";
                            if (f.name === "client_id" && item[f.name]) display = getClientName(item[f.name]);
                            else if (f.type === "select" && f.options && item[f.name]) {
                              const opt = f.options.find((o) => o.value === item[f.name]);
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
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Nova"} Obra</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {allTabs.length > 1 && (
              <div className="flex border-b border-border px-5 gap-1">
                {allTabs.map((t) => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "dados" && (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {fields.map((f) => (
                  <div key={f.name}>
                    <label className="block text-sm font-medium text-card-foreground mb-1">{f.label}</label>
                    {renderFormInput(f)}
                  </div>
                ))}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                  <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "anexos" && editing && (
              <div className="p-5"><Attachments entityType="obras" entityId={editing.id} /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
