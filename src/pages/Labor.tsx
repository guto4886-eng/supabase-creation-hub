import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download, Eraser,
  Power, Users, Upload, RefreshCw, FileSpreadsheet, CheckCircle, AlertTriangle, Save, Printer
} from "lucide-react";
import jsPDF from "jspdf";
import { exportCSV, exportExcel, exportPDF, fetchCompanyInfo } from "@/utils/exportWithHeader";
import { addReportHeader, addPageFooter } from "@/utils/pdfHeader";
import ExportDialog from "@/components/ExportDialog";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";
import { fetchCep } from "@/utils/cep";
import Attachments from "@/components/Attachments";
import LaborCharges from "@/components/labor/LaborCharges";
import LaborBenefits from "@/components/labor/LaborBenefits";
import LaborEpis from "@/components/labor/LaborEpis";
import LaborAllocations from "@/components/labor/LaborAllocations";
import LaborAttendance from "@/components/labor/LaborAttendance";

const ROLES = [
  // Operacional
  "Pedreiro", "Servente", "Mestre de obras", "Encanador", "Eletricista",
  "Pintor", "Carpinteiro", "Armador", "Azulejista", "Gesseiro",
  "Serralheiro", "Operador de máquinas", "Soldador", "Vidraceiro", "Marmorista",
  // Técnico
  "Engenheiro", "Arquiteto", "Técnico de segurança", "Técnico em edificações", "Topógrafo",
  // Administrativo
  "Assistente administrativo", "Auxiliar financeiro", "Comprador", "Almoxarife",
  "Recepcionista", "Secretária", "Recursos Humanos", "Departamento Pessoal",
  // Gestão
  "Gerente de obras", "Gerente de projetos", "Coordenador", "Supervisor",
  "Diretor", "Sócio/Proprietário",
  "Outro",
];

const CARGOS = [
  "Ajudante", "Auxiliar", "Operador", "Encarregado", "Supervisor",
  "Coordenador", "Gerente", "Diretor", "Estagiário", "Aprendiz", "Outro",
];

const SHIFT_TYPES = [
  { value: "comercial", label: "Comercial (08h-18h)" },
  { value: "integral", label: "Integral (12x36)" },
  { value: "noturno", label: "Noturno" },
  { value: "meio_periodo", label: "Meio período" },
  { value: "escala", label: "Escala" },
  { value: "outro", label: "Outro" },
];

const REMUNERATION_TYPES = [
  { value: "mensal", label: "Mensal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "semanal", label: "Semanal" },
  { value: "diaria", label: "Diária" },
  { value: "hora", label: "Por hora" },
  { value: "empreitada", label: "Empreitada" },
];

/** Calcula previsão de férias baseado no período aquisitivo (12 meses após admissão) */
function calcVacation(admissionDate: string | null): { acquisitiveEnd: string; vacationDeadline: string } | null {
  if (!admissionDate) return null;
  const admission = new Date(admissionDate + "T00:00:00");
  if (isNaN(admission.getTime())) return null;
  const today = new Date();
  // Encontrar o período aquisitivo atual
  let periodStart = new Date(admission);
  while (true) {
    const periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    if (periodEnd >= today || periodStart > today) break;
    periodStart.setFullYear(periodStart.getFullYear() + 1);
  }
  const acquisitiveEnd = new Date(periodStart);
  acquisitiveEnd.setFullYear(acquisitiveEnd.getFullYear() + 1);
  acquisitiveEnd.setDate(acquisitiveEnd.getDate() - 1);
  // Período concessivo: 12 meses após fim do aquisitivo
  const vacationDeadline = new Date(acquisitiveEnd);
  vacationDeadline.setFullYear(vacationDeadline.getFullYear() + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { acquisitiveEnd: fmt(acquisitiveEnd), vacationDeadline: fmt(vacationDeadline) };
}

const PAGE_SIZE = 15;

const IMPORT_FIELDS = [
  { name: "name", label: "Nome" },
  { name: "role", label: "Função" },
  { name: "daily_rate", label: "Diária" },
  { name: "start_date", label: "Data Início" },
  { name: "end_date", label: "Data Fim" },
  { name: "phone", label: "Telefone" },
  { name: "document", label: "CPF/Documento" },
  { name: "notes", label: "Observações" },
  { name: "obra_name", label: "Obra" },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if ((char === "," || char === ";") && !inQuotes) { result.push(current.trim()); current = ""; }
      else current += char;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c));
  return { headers, rows };
}

export default function Labor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: companiesList = [] } = useCompanies();

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterName, setFilterName] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [filterCondition, setFilterCondition] = useState<"ativo" | "inativo" | "ambos">("ativo");
  const [filterCompany, setFilterCompany] = useState("");
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formTab, setFormTab] = useState("dados");
  const [cepLoading, setCepLoading] = useState(false);
  const [blankFormCompanyModal, setBlankFormCompanyModal] = useState(false);

  // Data
  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name, company_id").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string; company_id: string | null }[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["obra_labor_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_labor" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const getObraName = (id: string) => obras.find(o => o.id === id)?.name ?? "—";

  const filtered = searched
    ? items.filter((item: any) => {
        if (filterName && !item.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
        if (filterRole && item.role !== filterRole) return false;
        if (filterObra && item.obra_id !== filterObra) return false;
        if (filterCondition === "ativo" && !item.active) return false;
        if (filterCondition === "inativo" && item.active) return false;
        if (filterCompany) {
          const obra = obras.find(o => o.id === item.obra_id);
          if (!obra || obra.company_id !== filterCompany) return false;
        }
        return true;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("obra_labor" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obra_labor" as any).insert({ ...values, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_labor_all"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_labor" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obra_labor_all"] }); toast.success("Removido!"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("obra_labor" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obra_labor_all"] }); toast.success("Status atualizado!"); },
  });

  const defaultForm = {
    name: "", role: "", daily_rate: "", start_date: "", end_date: "", phone: "", document: "",
    notes: "", active: true, obra_id: "", company_id: "", rg: "", birth_date: "", cellphone: "",
    email: "", cep: "", address: "", address_number: "", neighborhood: "", complement: "",
    state: "", city: "", contract_type: "", work_schedule: "", monthly_salary: "",
    admission_date: "", dismissal_date: "", pis: "", ctps: "", ctps_serie: "",
    cargo: "", shift_type: "", remuneration_type: "", remuneration_value: "", bonus_value: "",
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setFormTab("dados");
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const f: Record<string, any> = {};
    Object.keys(defaultForm).forEach(k => { f[k] = item[k] ?? ""; });
    f.active = item.active;
    setForm(f);
    setFormTab("dados");
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  const handleCepLookup = async (cep: string) => {
    setForm(p => ({ ...p, cep }));
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      setCepLoading(true);
      const result = await fetchCep(clean);
      if (result) {
        setForm(p => ({ ...p, address: result.address, neighborhood: result.neighborhood, city: result.city, state: result.state }));
      }
      setCepLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.company_id) { toast.error("Empresa é obrigatória"); return; }
    const cleaned: Record<string, any> = {
      name: form.name.trim(), obra_id: form.obra_id || null, company_id: form.company_id || null,
      role: form.role || null, daily_rate: form.daily_rate ? Number(form.daily_rate) : 0,
      start_date: form.start_date || null, end_date: form.end_date || null,
      phone: form.phone || null, document: form.document || null,
      notes: form.notes || null, active: form.active ?? true,
      rg: form.rg || null, birth_date: form.birth_date || null, cellphone: form.cellphone || null,
      email: form.email || null, cep: form.cep || null, address: form.address || null,
      address_number: form.address_number || null, neighborhood: form.neighborhood || null,
      complement: form.complement || null, state: form.state || null, city: form.city || null,
      contract_type: form.contract_type || null, work_schedule: form.work_schedule || null,
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : 0,
      admission_date: form.admission_date || null, dismissal_date: form.dismissal_date || null,
      pis: form.pis || null, ctps: form.ctps || null, ctps_serie: form.ctps_serie || null,
      cargo: form.cargo || null, shift_type: form.shift_type || null,
      remuneration_type: form.remuneration_type || null,
      remuneration_value: form.remuneration_value ? Number(form.remuneration_value) : 0,
      bonus_value: form.bonus_value ? Number(form.bonus_value) : 0,
    };
    saveMutation.mutate(cleaned);
  };

  const handleSearch = () => { setSearched(true); setPage(0); };
  const handleClearFilters = () => {
    setFilterName(""); setFilterRole(""); setFilterObra(""); setFilterCondition("ativo"); setFilterCompany(""); setSearched(false); setPage(0);
  };

  const generateBlankForm = async (companyId?: string) => {
    setBlankFormCompanyModal(false);
    let companyInfo: any = null;
    if (companyId) {
      const { data } = await supabase.from("companies").select("name, document, logo_url, address, city, state, phone, email").eq("id", companyId).maybeSingle();
      if (data) {
        companyInfo = { company_name: data.name, document: data.document, logo_url: data.logo_url, address: data.address, city: data.city, state: data.state, phone: data.phone, email: data.email };
      }
    }
    const doc = new jsPDF("p", "mm", "a4");
    const w = doc.internal.pageSize.getWidth();
    const M = 14;
    const usable = w - M * 2;

    let y = await addReportHeader(doc, companyInfo, "FICHA DE CADASTRO DE FUNCIONÁRIO");
    y += 2;

    doc.setDrawColor(150);
    doc.setLineWidth(0.2);

    const section = (title: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setFillColor(230, 230, 235);
      doc.rect(M, y, usable, 5, "F");
      doc.setTextColor(40, 40, 40);
      doc.text(title, M + 1.5, y + 3.5);
      y += 7;
    };

    const field = (label: string, fw: number, x: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(label, x, y);
      doc.setDrawColor(180);
      doc.line(x, y + 4, x + fw, y + 4);
    };

    const row = (fields: { label: string; width: number }[]) => {
      let x = M;
      const gap = 3;
      fields.forEach((f, i) => {
        field(f.label, f.width, x);
        x += f.width + gap;
      });
      y += 9;
    };

    // Dados Pessoais
    section("DADOS PESSOAIS");
    row([{ label: "Nome Completo", width: usable }]);
    row([{ label: "CPF", width: 50 }, { label: "RG", width: 50 }, { label: "Data Nascimento", width: usable - 106 }]);
    row([{ label: "Telefone", width: 45 }, { label: "Celular", width: 45 }, { label: "E-mail", width: usable - 96 }]);

    // Endereço
    section("ENDEREÇO");
    row([{ label: "CEP", width: 30 }, { label: "Endereço", width: usable - 33 }]);
    row([{ label: "Nº", width: 20 }, { label: "Complemento", width: 40 }, { label: "Bairro", width: 45 }, { label: "Cidade", width: 40 }, { label: "UF", width: usable - 157 }]);

    // Documentos
    section("DOCUMENTOS TRABALHISTAS");
    row([{ label: "PIS/PASEP", width: 55 }, { label: "CTPS Nº", width: 50 }, { label: "Série CTPS", width: usable - 111 }]);

    // Contratação
    section("DADOS DE CONTRATAÇÃO");
    row([{ label: "Empresa", width: usable }]);
    row([{ label: "Função", width: 50 }, { label: "Cargo", width: 50 }, { label: "Obra", width: usable - 106 }]);
    row([{ label: "Data Admissão", width: 38 }, { label: "Tipo Contrato", width: 38 }, { label: "Turno", width: 35 }, { label: "Horário", width: usable - 120 }]);
    row([{ label: "Tipo Remuneração", width: 42 }, { label: "Valor (R$)", width: 38 }, { label: "Diária (R$)", width: 35 }, { label: "Salário Mensal (R$)", width: usable - 124 }]);

    // Observações
    section("OBSERVAÇÕES");
    const obsH = Math.min(20, 277 - y - 25);
    doc.setDrawColor(180);
    doc.rect(M, y, usable, obsH);
    y += obsH + 5;

    // Assinaturas
    const sigW = (usable - 20) / 2;
    doc.setDrawColor(100);
    doc.line(M, y, M + sigW, y);
    doc.line(M + sigW + 20, y, M + sigW * 2 + 20, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("Assinatura do Funcionário", M + sigW / 2, y + 4, { align: "center" });
    doc.text("Assinatura do Responsável", M + sigW + 20 + sigW / 2, y + 4, { align: "center" });

    addPageFooter(doc);
    doc.save("ficha-cadastro-funcionario.pdf");
    toast.success("Ficha em branco gerada!");
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const tableFields = [
    { name: "name", label: "Nome" },
    { name: "role", label: "Função" },
    { name: "obra_id", label: "Obra" },
    { name: "daily_rate", label: "Diária" },
    { name: "start_date", label: "Início" },
    { name: "end_date", label: "Fim" },
    { name: "phone", label: "Telefone" },
    { name: "document", label: "Documento" },
    { name: "active", label: "Status" },
  ];

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden relative">
      {/* Filter Panel */}
      <div className="flex flex-shrink-0">
        <div className={`bg-muted transition-all duration-300 overflow-hidden ${filtersOpen ? "w-80" : "w-0"}`}>
          <div className="flex flex-col h-full w-80">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold text-primary uppercase flex items-center gap-2">
                <Users className="h-5 w-5" /> Mão de Obra
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Faça sua pesquisa aqui</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <CompanyFilterSelect value={filterCompany} onChange={setFilterCompany} companies={companiesList} className={inputClass} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                <select value={filterObra} onChange={(e) => setFilterObra(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Função</label>
                <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Condição</label>
                <div className="flex gap-4">
                  {([["ativo", "Ativo"], ["inativo", "Inativo"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="filterCondLabor" checked={filterCondition === val} onChange={() => setFilterCondition(val)} className="accent-primary" />
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
          <button onClick={() => setFiltersOpen(!filtersOpen)} className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 py-4 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all rounded-r-md ${filtersOpen ? "bg-primary" : "bg-amber-700"}`}>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1" style={{ writingMode: "vertical-lr" }}>
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
                <p className="text-sm text-muted-foreground mb-4">Cadastre um novo colaborador.</p>
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
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
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
                      {paginatedItems.map((item: any, idx: number) => (
                        <tr key={item.id} onClick={() => openEdit(item)} className={`cursor-pointer hover:bg-primary/10 transition-colors ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                          <td className="px-2 py-2 text-foreground font-medium">{item.name}</td>
                          <td className="px-2 py-2 text-foreground">{item.role || "—"}</td>
                          <td className="px-2 py-2 text-foreground">{getObraName(item.obra_id)}</td>
                          <td className="px-2 py-2 text-foreground">{item.daily_rate ? formatCurrency(Number(item.daily_rate)) : "—"}</td>
                          <td className="px-2 py-2 text-foreground whitespace-nowrap">{formatDate(item.start_date)}</td>
                          <td className="px-2 py-2 text-foreground whitespace-nowrap">{formatDate(item.end_date)}</td>
                          <td className="px-2 py-2 text-foreground">{item.phone || "—"}</td>
                          <td className="px-2 py-2 text-foreground">{item.document || "—"}</td>
                          <td className="px-2 py-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                              {item.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-0.5 justify-center">
                              <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })} className={`p-1 rounded ${item.active ? "hover:bg-accent text-amber-600" : "hover:bg-primary/10 text-primary"}`} title={item.active ? "Desativar" : "Ativar"}><Power className="h-3.5 w-3.5" /></button>
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
                      <Plus className="h-3.5 w-3.5" /> Novo
                    </button>
                    <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded text-xs font-medium hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" /> Importar
                    </button>
                    {filtered.length > 0 && (
                      <button onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-primary text-xs hover:underline">
                        <Download className="h-3.5 w-3.5" /> Exportar
                      </button>
                    )}
                    <button onClick={() => setBlankFormCompanyModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded text-xs font-medium hover:bg-muted">
                      <Printer className="h-3.5 w-3.5" /> Ficha em Branco
                    </button>
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

      {/* Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-primary">{editing ? "Editar colaborador" : "Novo colaborador"}</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-muted/30">
              {[
                { key: "dados", label: "Dados" },
                { key: "contratacao", label: "Contratação" },
                { key: "encargos", label: "Encargos" },
                { key: "beneficios", label: "Benefícios" },
                { key: "epi", label: "EPI" },
                { key: "historico", label: "Histórico de alocação" },
                { key: "frequencia", label: "Frequência" },
                { key: "anexos", label: "Anexos" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFormTab(tab.key)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    formTab === tab.key
                      ? "text-primary border-b-2 border-primary bg-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {formTab === "dados" && (
                <div className="space-y-5">
                  {/* Empresa + Nome */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Empresa *</label>
                      <select value={form.company_id || ""} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {companiesList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
                      <input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* CPF, RG, Dt. Nascimento */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">CPF</label>
                      <input value={form.document || ""} onChange={e => setForm(p => ({ ...p, document: e.target.value }))} className={inputClass} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">RG</label>
                      <input value={form.rg || ""} onChange={e => setForm(p => ({ ...p, rg: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Dt. Nascimento</label>
                      <input type="date" value={form.birth_date || ""} onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Telefone, Celular */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                      <input value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Celular</label>
                      <input value={form.cellphone || ""} onChange={e => setForm(p => ({ ...p, cellphone: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Função</label>
                      <select value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                    <input type="email" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
                  </div>

                  {/* Address section */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="text-sm font-medium text-muted-foreground px-2">Endereço</legend>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">CEP</label>
                        <input value={form.cep || ""} onChange={e => handleCepLookup(e.target.value)} className={inputClass} placeholder="00000-000" />
                        {cepLoading && <span className="text-xs text-muted-foreground">Buscando...</span>}
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-foreground mb-1">Logradouro</label>
                        <input value={form.address || ""} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Número</label>
                        <input value={form.address_number || ""} onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-foreground mb-1">Bairro</label>
                        <input value={form.neighborhood || ""} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                        <input value={form.complement || ""} onChange={e => setForm(p => ({ ...p, complement: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">UF</label>
                        <input value={form.state || ""} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={inputClass} maxLength={2} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
                        <input value={form.city || ""} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>

                  {/* Obra + Observações + Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                      <select value={form.obra_id || ""} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                        <option value="">Nenhuma</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Diária (R$)</label>
                      <input type="number" step="0.01" value={form.daily_rate || ""} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                    <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
                  </div>
                  {editing && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-foreground">Ativo?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={form.active === true} onChange={() => setForm(p => ({ ...p, active: true }))} className="accent-primary" /> Sim</label>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={form.active === false} onChange={() => setForm(p => ({ ...p, active: false }))} className="accent-primary" /> Não</label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formTab === "contratacao" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tipo de contrato</label>
                      <select value={form.contract_type || ""} onChange={e => setForm(p => ({ ...p, contract_type: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        <option value="clt">CLT</option>
                        <option value="pj">PJ</option>
                        <option value="temporario">Temporário</option>
                        <option value="autonomo">Autônomo</option>
                        <option value="estagio">Estágio</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Cargo</label>
                      <select value={form.cargo || ""} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Tipo de turno</label>
                      <select value={form.shift_type || ""} onChange={e => setForm(p => ({ ...p, shift_type: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {SHIFT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Jornada de trabalho</label>
                      <input value={form.work_schedule || ""} onChange={e => setForm(p => ({ ...p, work_schedule: e.target.value }))} className={inputClass} placeholder="Ex: 08h às 17h" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Salário mensal (R$)</label>
                      <input type="number" step="0.01" value={form.monthly_salary || ""} onChange={e => setForm(p => ({ ...p, monthly_salary: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Remuneração */}
                  <fieldset className="border border-border rounded-lg p-4 space-y-3">
                    <legend className="text-sm font-medium text-muted-foreground px-2">Remuneração</legend>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Tipo de remuneração</label>
                        <select value={form.remuneration_type || ""} onChange={e => setForm(p => ({ ...p, remuneration_type: e.target.value }))} className={inputClass}>
                          <option value="">Selecione...</option>
                          {REMUNERATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
                        <input type="number" step="0.01" value={form.remuneration_value || ""} onChange={e => setForm(p => ({ ...p, remuneration_value: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Bonificação (R$)</label>
                        <input type="number" step="0.01" value={form.bonus_value || ""} onChange={e => setForm(p => ({ ...p, bonus_value: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Data admissão</label>
                      <input type="date" value={form.admission_date || ""} onChange={e => setForm(p => ({ ...p, admission_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Data demissão</label>
                      <input type="date" value={form.dismissal_date || ""} onChange={e => setForm(p => ({ ...p, dismissal_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>

                  {/* Previsão de Férias */}
                  {form.admission_date && (() => {
                    const vac = calcVacation(form.admission_date);
                    if (!vac) return null;
                    return (
                      <fieldset className="border border-primary/30 rounded-lg p-4 space-y-2 bg-primary/5">
                        <legend className="text-sm font-semibold text-primary px-2">📅 Previsão de Férias</legend>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Fim do período aquisitivo</label>
                            <p className="text-sm font-medium text-foreground">{formatDate(vac.acquisitiveEnd)}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Data limite para férias</label>
                            <p className="text-sm font-medium text-foreground">{formatDate(vac.vacationDeadline)}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          O colaborador deve gozar férias até a data limite, caso contrário a empresa deverá pagar em dobro.
                        </p>
                      </fieldset>
                    );
                  })()}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">PIS</label>
                      <input value={form.pis || ""} onChange={e => setForm(p => ({ ...p, pis: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">CTPS</label>
                      <input value={form.ctps || ""} onChange={e => setForm(p => ({ ...p, ctps: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Série CTPS</label>
                      <input value={form.ctps_serie || ""} onChange={e => setForm(p => ({ ...p, ctps_serie: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Data início</label>
                      <input type="date" value={form.start_date || ""} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Data fim</label>
                      <input type="date" value={form.end_date || ""} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                </div>
              )}

              {formTab === "encargos" && editing && (
                <LaborCharges laborId={editing.id} salary={Number(editing.monthly_salary || editing.remuneration_value || 0)} />
              )}
              {formTab === "encargos" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar encargos.</p>
                </div>
              )}

              {formTab === "beneficios" && editing && (
                <LaborBenefits laborId={editing.id} />
              )}
              {formTab === "beneficios" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar benefícios.</p>
                </div>
              )}

              {formTab === "epi" && editing && (
                <LaborEpis laborId={editing.id} />
              )}
              {formTab === "epi" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar EPIs.</p>
                </div>
              )}

              {formTab === "historico" && editing && (
                <LaborAllocations laborId={editing.id} />
              )}
              {formTab === "historico" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar histórico.</p>
                </div>
              )}

              {formTab === "frequencia" && editing && (
                <LaborAttendance laborId={editing.id} laborName={editing.name} companyId={editing.company_id} shiftType={editing.shift_type} workSchedule={editing.work_schedule} />
              )}
              {formTab === "frequencia" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar frequência.</p>
                </div>
              )}

              {formTab === "anexos" && editing && (
                <Attachments entityType="obra_labor" entityId={editing.id} />
              )}
              {formTab === "anexos" && !editing && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <p className="text-sm">Salve o colaborador primeiro para gerenciar anexos.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted rounded-b-xl">
              <button onClick={closeForm} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">Cancelar</button>
              <button onClick={() => handleSubmit()} disabled={saveMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Save className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importOpen && (
        <LaborImportModal
          obras={obras}
          onClose={() => setImportOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ["obra_labor_all"] })}
        />
      )}

      {exportOpen && (
        <ExportDialog
          onSelect={async (format) => {
            const exportFields = [
              { name: "Nome", label: "Nome" }, { name: "Função", label: "Função" },
              { name: "Obra", label: "Obra" }, { name: "Diária", label: "Diária" },
              { name: "Início", label: "Início" }, { name: "Fim", label: "Fim" },
              { name: "Telefone", label: "Telefone" }, { name: "Documento", label: "Documento" },
              { name: "Status", label: "Status" },
            ];
            const exportData = filtered.map((item: any) => ({
              Nome: item.name, Função: item.role || "", Obra: getObraName(item.obra_id),
              Diária: item.daily_rate || 0, Início: item.start_date || "", Fim: item.end_date || "",
              Telefone: item.phone || "", Documento: item.document || "", Status: item.active ? "Ativo" : "Inativo",
            }));
            const company = user ? await fetchCompanyInfo(user.id) : null;
            if (format === "csv") exportCSV(exportData, exportFields, "mao_de_obra", company);
            else if (format === "excel") exportExcel(exportData, exportFields, "mao_de_obra", company);
            else if (format === "pdf") await exportPDF(exportData, exportFields, "mao_de_obra", company);
            setExportOpen(false);
          }}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Company selector for blank form */}
      {blankFormCompanyModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setBlankFormCompanyModal(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-xl p-6 w-[380px] max-w-[90vw] space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              Gerar Ficha em Branco
            </h3>
            <p className="text-xs text-muted-foreground">Selecione a empresa para o cabeçalho do formulário:</p>
            <div className="space-y-2">
              {companiesList.map(c => (
                <button
                  key={c.id}
                  onClick={() => generateBlankForm(c.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-sm text-foreground"
                >
                  {c.name}
                </button>
              ))}
              {companiesList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhuma empresa cadastrada</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBlankFormCompanyModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => generateBlankForm()} className="px-4 py-2 text-sm rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors">
                Sem Cabeçalho
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Import Modal ───
function LaborImportModal({ obras, onClose, onDone }: { obras: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mappings, setMappings] = useState<{ csvColumn: string; dbField: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedObra, setSelectedObra] = useState("");

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      setCsvData(parsed);
      const autoMappings: { csvColumn: string; dbField: string }[] = [];
      parsed.headers.forEach((h) => {
        const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = IMPORT_FIELDS.find((f) => {
          const nl = f.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return nl === norm || f.name === norm || nl.includes(norm) || norm.includes(nl);
        });
        if (match) autoMappings.push({ csvColumn: h, dbField: match.name });
      });
      setMappings(autoMappings);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const updateMapping = (csvColumn: string, dbField: string) => {
    setMappings((prev) => {
      const filtered = prev.filter((m) => m.csvColumn !== csvColumn);
      if (dbField) filtered.push({ csvColumn, dbField });
      return filtered;
    });
  };

  const handleImport = async () => {
    if (!csvData || !user || !selectedObra) { toast.error("Selecione uma obra"); return; }
    setImporting(true);
    let success = 0, errors = 0;
    for (const row of csvData.rows) {
      const record: Record<string, any> = { user_id: user.id, obra_id: selectedObra, active: true };
      mappings.forEach((m) => {
        const idx = csvData.headers.indexOf(m.csvColumn);
        if (idx >= 0 && row[idx]) {
          if (m.dbField === "daily_rate") record[m.dbField] = Number(row[idx].replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
          else if (m.dbField !== "obra_name") record[m.dbField] = row[idx];
        }
      });
      if (!record.name) { errors++; continue; }
      const { error } = await supabase.from("obra_labor" as any).insert(record as any);
      if (error) errors++; else success++;
    }
    setResult({ success, errors });
    setImporting(false);
    setStep("result");
    if (success > 0) { onDone(); toast.success(`${success} funcionário(s) importado(s)!`); }
    if (errors > 0) toast.error(`${errors} registro(s) com erro`);
  };

  const resetImport = () => { setCsvData(null); setMappings([]); setResult(null); setStep("upload"); setFileName(""); };

  const generateTemplate = () => {
    const BOM = "\uFEFF";
    const csv = BOM + IMPORT_FIELDS.filter(f => f.name !== "obra_name").map(f => f.label).join(";");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_mao_de_obra.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importar funcionários</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === "upload" ? "text-primary font-medium" : ""}>1. Upload</span><span>→</span>
            <span className={step === "mapping" ? "text-primary font-medium" : ""}>2. Mapeamento</span><span>→</span>
            <span className={step === "result" ? "text-primary font-medium" : ""}>3. Resultado</span>
          </div>

          {/* Obra selector - always visible before result */}
          {step !== "result" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Obra destino *</label>
              <select value={selectedObra} onChange={e => setSelectedObra(e.target.value)} className={inputClass}>
                <option value="">Selecione a obra...</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {step === "upload" && (
            <>
              <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Instruções</p>
                <p className="text-xs text-muted-foreground">Baixe o modelo, preencha com os dados dos funcionários e importe.</p>
                <button onClick={generateTemplate} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted">
                  <Download className="h-3.5 w-3.5" /> Baixar planilha modelo
                </button>
              </div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Selecione um arquivo CSV</p>
                <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Selecionar arquivo
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
                </label>
              </div>
            </>
          )}

          {step === "mapping" && csvData && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-foreground font-medium">{fileName}</span>
                <span className="text-muted-foreground">— {csvData.rows.length} linha(s)</span>
                <button onClick={resetImport} className="ml-auto text-xs text-primary hover:underline">Trocar arquivo</button>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Mapeamento de colunas</h4>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {csvData.headers.map((h) => {
                    const mapping = mappings.find((m) => m.csvColumn === h);
                    return (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-sm text-foreground w-40 truncate font-mono bg-muted/50 px-2 py-1 rounded">{h}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <select value={mapping?.dbField ?? ""} onChange={(e) => updateMapping(h, e.target.value)} className={inputClass + " flex-1"}>
                          <option value="">Ignorar</option>
                          {IMPORT_FIELDS.map((f) => (
                            <option key={f.name} value={f.name} disabled={mappings.some((m) => m.dbField === f.name && m.csvColumn !== h)}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              {csvData.rows.length > 0 && mappings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Pré-visualização</h4>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50">{mappings.map(m => <th key={m.dbField} className="px-3 py-2 text-left font-medium text-muted-foreground">{IMPORT_FIELDS.find(f => f.name === m.dbField)?.label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">
                        {csvData.rows.slice(0, 3).map((row, i) => (
                          <tr key={i}>{mappings.map(m => { const idx = csvData.headers.indexOf(m.csvColumn); return <td key={m.dbField} className="px-3 py-2 text-foreground">{idx >= 0 ? row[idx] : "—"}</td>; })}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={resetImport} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Voltar</button>
                <button onClick={handleImport} disabled={importing || mappings.length === 0 || !selectedObra} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {importing ? "Importando..." : `Importar ${csvData.rows.length} funcionário(s)`}
                </button>
              </div>
            </>
          )}

          {step === "result" && result && (
            <div className="space-y-4 text-center py-4">
              <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${result.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                {result.errors > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {result.success} importado(s), {result.errors} erro(s)
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={resetImport} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Nova importação</button>
                <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Concluir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
