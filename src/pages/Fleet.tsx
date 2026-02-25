import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Eraser, Car, FileText
} from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import Attachments from "@/components/Attachments";
import VehicleDocuments from "@/components/VehicleDocuments";
import VehicleMaintenances from "@/components/VehicleMaintenances";
import VehicleFueling from "@/components/VehicleFueling";
import VehicleInsurance from "@/components/VehicleInsurance";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";
import { generateVehicleReport } from "@/utils/vehicleReport";

const CATEGORY_OPTIONS = [
  { value: "carro", label: "Carro" },
  { value: "caminhonete", label: "Caminhonete" },
  { value: "caminhao", label: "Caminhão" },
  { value: "van", label: "Van" },
  { value: "moto", label: "Moto" },
  { value: "maquina", label: "Máquina/Equipamento" },
  { value: "outro", label: "Outro" },
];

const FUEL_OPTIONS = [
  { value: "flex", label: "Flex" },
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "gnv", label: "GNV" },
  { value: "eletrico", label: "Elétrico" },
  { value: "hibrido", label: "Híbrido" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "manutencao", label: "Em Manutenção" },
  { value: "inativo", label: "Inativo" },
];

const PAGE_SIZE = 15;

const inputCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function Fleet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterPlate, setFilterPlate] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ativo" | "inativo" | "manutencao" | "todos">("ativo");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState("dados");

  const { data: companiesList = [] } = useCompanies();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = searched
    ? items.filter((item: any) => {
        if (filterPlate && !item.plate?.toLowerCase().includes(filterPlate.toLowerCase())) return false;
        if (filterBrand && !item.brand?.toLowerCase().includes(filterBrand.toLowerCase())) return false;
        if (filterModel && !item.model?.toLowerCase().includes(filterModel.toLowerCase())) return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterStatus !== "todos" && item.status !== filterStatus) return false;
        if (filterOwner && !item.owner_name?.toLowerCase().includes(filterOwner.toLowerCase())) return false;
        if (filterCompany && item.company_id !== filterCompany) return false;
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicles" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles" as any).insert({ ...values, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(editing ? "Veículo atualizado!" : "Veículo cadastrado!", { duration: 3000 });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("vehicles" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Status atualizado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const defaultForm = () => ({
    plate: "", brand: "", model: "", year_manufacture: "", year_model: "", color: "",
    category: "carro", fuel_type: "flex", renavam: "", chassis: "",
    owner_name: "", owner_document: "", acquisition_date: "", acquisition_value: "",
    km_current: "0", status: "ativo", notes: "", company_id: "",
    market_value: "", depreciation_rate: "",
  });

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm());
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const f: Record<string, any> = {};
    Object.keys(defaultForm()).forEach(k => f[k] = item[k] ?? "");
    setForm(f);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); setActiveTab("dados"); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    saveMutation.mutate(cleaned);
  };

  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClearFilters = () => {
    setFilterPlate(""); setFilterBrand(""); setFilterModel(""); setFilterCategory(""); setFilterStatus("ativo"); setFilterOwner(""); setFilterCompany(""); setSearched(false); setPage(0);
  };

  const tableFields = [
    { name: "plate", label: "Placa" },
    { name: "brand", label: "Marca" },
    { name: "model", label: "Modelo" },
    { name: "year_model", label: "Ano" },
    { name: "color", label: "Cor" },
    { name: "category", label: "Categoria", computed: true },
    { name: "owner_name", label: "Proprietário" },
    { name: "km_current", label: "KM Atual" },
    { name: "status", label: "Status", computed: true },
  ];

  const allTabs = [
    { key: "dados", label: "Dados" },
    { key: "documentos", label: "Documentos/Taxas" },
    { key: "seguro", label: "Seguro" },
    { key: "manutencoes", label: "Manutenções" },
    { key: "abastecimentos", label: "Abastecimentos" },
    ...(editing ? [{ key: "anexos", label: "Anexos" }] : []),
  ];

  // FIPE lookup state
  const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";
  const [fipeTipo, setFipeTipo] = useState<string>("carros");
  const [fipeMarcas, setFipeMarcas] = useState<any[]>([]);
  const [fipeMarca, setFipeMarca] = useState("");
  const [fipeModelos, setFipeModelos] = useState<any[]>([]);
  const [fipeModelo, setFipeModelo] = useState("");
  const [fipeAnos, setFipeAnos] = useState<any[]>([]);
  const [fipeAno, setFipeAno] = useState("");
  const [fipeLoading, setFipeLoading] = useState(false);
  const [fipeError, setFipeError] = useState("");

  // Load marcas when tipo changes
  useEffect(() => {
    if (!formOpen) return;
    setFipeMarcas([]); setFipeMarca(""); setFipeModelos([]); setFipeModelo(""); setFipeAnos([]); setFipeAno("");
    fetch(`${FIPE_BASE}/${fipeTipo}/marcas`).then(r => r.json()).then(setFipeMarcas).catch(() => {});
  }, [fipeTipo, formOpen]);

  // Load modelos when marca changes
  useEffect(() => {
    if (!fipeMarca) { setFipeModelos([]); setFipeModelo(""); setFipeAnos([]); setFipeAno(""); return; }
    fetch(`${FIPE_BASE}/${fipeTipo}/marcas/${fipeMarca}/modelos`).then(r => r.json()).then(d => {
      setFipeModelos(d.modelos || []);
      setFipeAnos(d.anos || []);
    }).catch(() => {});
    setFipeModelo(""); setFipeAno("");
  }, [fipeMarca, fipeTipo]);

  // Load anos when modelo changes
  useEffect(() => {
    if (!fipeModelo || !fipeMarca) { setFipeAnos([]); setFipeAno(""); return; }
    fetch(`${FIPE_BASE}/${fipeTipo}/marcas/${fipeMarca}/modelos/${fipeModelo}/anos`).then(r => r.json()).then(setFipeAnos).catch(() => {});
    setFipeAno("");
  }, [fipeModelo, fipeMarca, fipeTipo]);

  const consultarFipe = useCallback(async () => {
    if (!fipeMarca || !fipeModelo || !fipeAno) { toast.error("Selecione marca, modelo e ano"); return; }
    setFipeLoading(true); setFipeError("");
    try {
      const res = await fetch(`${FIPE_BASE}/${fipeTipo}/marcas/${fipeMarca}/modelos/${fipeModelo}/anos/${fipeAno}`);
      if (!res.ok) throw new Error("Erro ao consultar FIPE");
      const data = await res.json();
      const priceStr = data.Valor || data.valor || "";
      const price = Number(priceStr.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      if (price > 0) {
        const acquisitionValue = Number(form.acquisition_value) || 0;
        const depRate = acquisitionValue > 0 && price < acquisitionValue
          ? Math.round(((1 - price / acquisitionValue) * 100) * 10) / 10
          : 0;
        setForm(p => ({ ...p, market_value: price, depreciation_rate: depRate }));
        toast.success(`Valor FIPE: ${priceStr}`);
      } else {
        setFipeError("Valor não encontrado na tabela FIPE");
      }
    } catch (err: any) {
      setFipeError(err.message || "Erro na consulta FIPE");
    } finally {
      setFipeLoading(false);
    }
  }, [fipeTipo, fipeMarca, fipeModelo, fipeAno, form.acquisition_value]);

  const fmt = (v: any) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Car className="h-5 w-5" />
                Frota
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <CompanyFilterSelect value={filterCompany} onChange={setFilterCompany} companies={companiesList} className={inputCls} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Placa</label>
                <input type="text" value={filterPlate} onChange={e => setFilterPlate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Marca</label>
                <input type="text" value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Modelo</label>
                <input type="text" value={filterModel} onChange={e => setFilterModel(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={inputCls}>
                  <option value="">Todas</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Proprietário</label>
                <input type="text" value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex flex-wrap gap-3">
                  {([["ativo", "Ativo"], ["manutencao", "Manutenção"], ["inativo", "Inativo"], ["todos", "Todos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterStatusFleet" checked={filterStatus === val} onChange={() => setFilterStatus(val)} className="accent-primary" />
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

        {/* Toggle */}
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
                <h3 className="text-xl font-semibold text-foreground mb-2">Inclua um novo veículo!</h3>
                <p className="text-sm text-muted-foreground mb-4">Cadastre um novo veículo na frota.</p>
                <button onClick={openNew} className="w-48 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
                  Incluir Novo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</h3>
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={() => exportToCSV(filtered, tableFields.map(f => ({ name: f.name, label: f.label })), "frota")} className="flex items-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
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
              <div className="text-center py-12 text-muted-foreground">Nenhum veículo encontrado.</div>
            ) : (
              <>
                <div className="flex-1 overflow-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/50">
                        <th className="w-10 px-2 py-3"><input type="checkbox" disabled className="accent-primary" /></th>
                        {tableFields.map(f => <th key={f.name} className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>)}
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Cadastro</th>
                        <th className="w-20 px-3 py-3 font-medium text-muted-foreground text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item: any, idx: number) => {
                        const catLabel = CATEGORY_OPTIONS.find(c => c.value === item.category)?.label ?? item.category ?? "";
                        const statusLabel = STATUS_OPTIONS.find(s => s.value === item.status)?.label ?? item.status ?? "";
                        return (
                          <tr key={item.id} onClick={() => openEdit(item)} className={`border-b border-border transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40 ${!item.active ? "opacity-50" : ""}`}>
                            <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" className="accent-primary" /></td>
                            {tableFields.map(f => {
                              let val: any;
                              if (f.name === "category") val = catLabel;
                              else if (f.name === "status") val = statusLabel;
                              else if (f.name === "km_current") val = item.km_current ? Number(item.km_current).toLocaleString("pt-BR") : "";
                              else val = item[f.name] ?? "";
                              return <td key={f.name} className="px-3 py-2.5 text-foreground truncate max-w-[150px]" title={String(val)}>{String(val)}</td>;
                            })}
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(item.created_at).toLocaleDateString("pt-BR")} {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => openEdit(item)} title="Editar" className="p-1.5 rounded-md hover:bg-accent text-primary"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Novo"} veículo</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/30">
              {allTabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px text-center ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "dados" && (
                <form id="fleet-form" onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Identificação do Veículo */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Identificação do Veículo</legend>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Placa *</label>
                        <input type="text" required value={form.plate || ""} onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} placeholder="ABC-1234" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">RENAVAM</label>
                        <input type="text" value={form.renavam || ""} onChange={e => setForm(p => ({ ...p, renavam: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Chassi</label>
                        <input type="text" value={form.chassis || ""} onChange={e => setForm(p => ({ ...p, chassis: e.target.value.toUpperCase() }))} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Marca</label>
                        <input type="text" value={form.brand || ""} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Modelo</label>
                        <input type="text" value={form.model || ""} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Ano Fabricação</label>
                        <input type="number" value={form.year_manufacture || ""} onChange={e => setForm(p => ({ ...p, year_manufacture: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Ano Modelo</label>
                        <input type="number" value={form.year_model || ""} onChange={e => setForm(p => ({ ...p, year_model: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Cor</label>
                        <input type="text" value={form.color || ""} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Categoria</label>
                        <select value={form.category || "carro"} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                          {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Combustível</label>
                        <select value={form.fuel_type || "flex"} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))} className={inputCls}>
                          {FUEL_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">KM Atual</label>
                        <input type="number" value={form.km_current || ""} onChange={e => setForm(p => ({ ...p, km_current: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Proprietário */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Dados do Proprietário</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Nome do Proprietário</label>
                        <input type="text" value={form.owner_name || ""} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">CPF/CNPJ do Proprietário</label>
                        <input type="text" value={form.owner_document || ""} onChange={e => setForm(p => ({ ...p, owner_document: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Empresa */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Empresa Vinculada</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Empresa</label>
                        <select value={form.company_id || ""} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} className={inputCls}>
                          <option value="">Nenhuma</option>
                          {companiesList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                        <select value={form.status || "ativo"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {/* Aquisição */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Aquisição</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Data de Aquisição</label>
                        <input type="date" value={form.acquisition_date || ""} onChange={e => setForm(p => ({ ...p, acquisition_date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Valor de Aquisição (R$)</label>
                        <input type="number" step="0.01" value={form.acquisition_value || ""} onChange={e => setForm(p => ({ ...p, acquisition_value: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Consulta FIPE */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Consulta Tabela FIPE</legend>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Tipo</label>
                        <select value={fipeTipo} onChange={e => setFipeTipo(e.target.value)} className={inputCls}>
                          <option value="carros">Carros</option>
                          <option value="motos">Motos</option>
                          <option value="caminhoes">Caminhões</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Marca</label>
                        <select value={fipeMarca} onChange={e => setFipeMarca(e.target.value)} className={inputCls}>
                          <option value="">Selecione</option>
                          {fipeMarcas.map((m: any) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Modelo</label>
                        <select value={fipeModelo} onChange={e => setFipeModelo(e.target.value)} className={inputCls} disabled={!fipeMarca}>
                          <option value="">Selecione</option>
                          {fipeModelos.map((m: any) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Ano</label>
                        <select value={fipeAno} onChange={e => setFipeAno(e.target.value)} className={inputCls} disabled={!fipeModelo}>
                          <option value="">Selecione</option>
                          {fipeAnos.map((a: any) => <option key={a.codigo} value={a.codigo}>{a.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={consultarFipe} disabled={fipeLoading || !fipeAno} className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50 flex items-center gap-2">
                        <Search className="h-4 w-4" /> {fipeLoading ? "Consultando..." : "Consultar FIPE"}
                      </button>
                      {fipeError && <span className="text-xs text-destructive">{fipeError}</span>}
                    </div>
                  </fieldset>

                  {/* Valor de Mercado e Depreciação */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="px-2 text-sm font-medium text-foreground italic">Valor de Mercado e Depreciação</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Valor de Mercado FIPE (R$)</label>
                        <input type="number" step="0.01" readOnly value={form.market_value || ""} className={`${inputCls} bg-muted`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Depreciação sobre Aquisição (%)</label>
                        <input type="number" step="0.1" readOnly value={form.depreciation_rate || ""} className={`${inputCls} bg-muted`} />
                      </div>
                    </div>
                    {form.market_value && form.acquisition_value && Number(form.acquisition_value) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Depreciação acumulada: {((1 - Number(form.market_value) / Number(form.acquisition_value)) * 100).toFixed(1)}% 
                        ({(Number(form.acquisition_value) - Number(form.market_value)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground italic">* Valor de mercado obtido da Tabela FIPE. Use os campos acima para consultar.</p>
                  </fieldset>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                    <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Informações adicionais..." className={inputCls} />
                  </div>
                </form>
              )}

              {activeTab === "documentos" && editing && (
                <div className="p-6"><VehicleDocuments vehicleId={editing.id} /></div>
              )}
              {activeTab === "documentos" && !editing && (
                <div className="p-6 text-center text-muted-foreground py-12">Salve o veículo primeiro para adicionar documentos</div>
              )}
              {activeTab === "seguro" && editing && (
                <div className="p-6"><VehicleInsurance vehicleId={editing.id} /></div>
              )}
              {activeTab === "seguro" && !editing && (
                <div className="p-6 text-center text-muted-foreground py-12">Salve o veículo primeiro para adicionar seguros</div>
              )}
              {activeTab === "manutencoes" && editing && (
                <div className="p-6"><VehicleMaintenances vehicleId={editing.id} /></div>
              )}
              {activeTab === "manutencoes" && !editing && (
                <div className="p-6 text-center text-muted-foreground py-12">Salve o veículo primeiro para registrar manutenções</div>
              )}
              {activeTab === "abastecimentos" && editing && (
                <div className="p-6"><VehicleFueling vehicleId={editing.id} /></div>
              )}
              {activeTab === "abastecimentos" && !editing && (
                <div className="p-6 text-center text-muted-foreground py-12">Salve o veículo primeiro para registrar abastecimentos</div>
              )}
              {activeTab === "anexos" && editing && (
                <div className="p-6"><Attachments entityType="vehicles" entityId={editing.id} /></div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between gap-3 px-6 py-3 border-t border-border bg-muted rounded-b-xl">
              <div>
                {editing && (
                  <button type="button" onClick={() => generateVehicleReport(editing)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" /> Gerar Relatório PDF
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" form="fleet-form" disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
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
