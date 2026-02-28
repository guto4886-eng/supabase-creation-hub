import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Users, Power, RefreshCw, Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle } from "lucide-react";

interface Props { obraId: string; }

const ROLES = [
  "Pedreiro", "Servente", "Mestre de obras", "Encanador", "Eletricista",
  "Pintor", "Carpinteiro", "Armador", "Azulejista", "Gesseiro",
  "Serralheiro", "Engenheiro", "Arquiteto", "Técnico de segurança", "Outro",
];

const IMPORT_FIELDS = [
  { name: "name", label: "Nome" },
  { name: "role", label: "Função" },
  { name: "daily_rate", label: "Diária" },
  { name: "start_date", label: "Data Início" },
  { name: "end_date", label: "Data Fim" },
  { name: "phone", label: "Telefone" },
  { name: "document", label: "CPF/Documento" },
  { name: "notes", label: "Observações" },
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

function generateTemplate(): void {
  const BOM = "\uFEFF";
  const csv = BOM + IMPORT_FIELDS.map((f) => f.label).join(";");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_mao_de_obra.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import Modal ───
function LaborImportModal({ obraId, onClose, onDone }: { obraId: string; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mappings, setMappings] = useState<{ csvColumn: string; dbField: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState("");

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
    if (!csvData || !user) return;
    setImporting(true);
    let success = 0, errors = 0;
    for (const row of csvData.rows) {
      const record: Record<string, any> = { user_id: user.id, obra_id: obraId, active: true };
      mappings.forEach((m) => {
        const idx = csvData.headers.indexOf(m.csvColumn);
        if (idx >= 0 && row[idx]) {
          if (m.dbField === "daily_rate") record[m.dbField] = Number(row[idx].replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
          else record[m.dbField] = row[idx];
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar funcionários
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === "upload" ? "text-primary font-medium" : ""}>1. Upload</span><span>→</span>
            <span className={step === "mapping" ? "text-primary font-medium" : ""}>2. Mapeamento</span><span>→</span>
            <span className={step === "result" ? "text-primary font-medium" : ""}>3. Resultado</span>
          </div>

          {step === "upload" && (
            <>
              <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Instruções</p>
                <p className="text-xs text-muted-foreground">Baixe o modelo abaixo, preencha com os dados dos funcionários e importe o arquivo.</p>
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
                      <thead><tr className="bg-muted/50">{mappings.map((m) => <th key={m.dbField} className="px-3 py-2 text-left font-medium text-muted-foreground">{IMPORT_FIELDS.find(f => f.name === m.dbField)?.label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">
                        {csvData.rows.slice(0, 3).map((row, i) => (
                          <tr key={i}>{mappings.map((m) => { const idx = csvData.headers.indexOf(m.csvColumn); return <td key={m.dbField} className="px-3 py-2 text-foreground">{idx >= 0 ? row[idx] : "—"}</td>; })}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={resetImport} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Voltar</button>
                <button onClick={handleImport} disabled={importing || mappings.length === 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
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

// ─── Main Component ───
export default function ObraLabor({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["obra_labor", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_labor" as any).select("*").eq("obra_id", obraId).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const resetForm = () => {
    setForm({ name: "", role: "", daily_rate: "", start_date: "", end_date: "", phone: "", document: "", notes: "", active: true });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name || "", role: item.role || "", daily_rate: item.daily_rate ?? "",
      start_date: item.start_date || "", end_date: item.end_date || "",
      phone: item.phone || "", document: item.document || "", notes: item.notes || "", active: item.active,
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Nome é obrigatório");
      const payload: any = {
        obra_id: obraId, user_id: user!.id, name: form.name.trim(),
        role: form.role || null, daily_rate: form.daily_rate ? Number(form.daily_rate) : 0,
        start_date: form.start_date || null, end_date: form.end_date || null,
        phone: form.phone || null, document: form.document || null,
        notes: form.notes || null, active: form.active,
      };
      if (editing) {
        const { error } = await supabase.from("obra_labor" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obra_labor" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_labor", obraId] });
      setModalOpen(false); resetForm();
      toast.success(editing ? "Atualizado!" : "Adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_labor" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obra_labor", obraId] }); toast.success("Removido!"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("obra_labor" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obra_labor", obraId] }); toast.success("Status atualizado!"); },
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

  const activeEntries = entries.filter((e: any) => e.active);
  const inactiveEntries = entries.filter((e: any) => !e.active);

  return (
    <div className="p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => refetch()} className="text-primary text-xs hover:underline flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-4 py-2 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" /> Importar
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo colaborador
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
            <Users className="h-12 w-12 text-amber-400" />
            <p className="text-sm font-medium text-amber-600">NENHUM COLABORADOR CADASTRADO.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Função</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Diária</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Início</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fim</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                <th className="w-24 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...activeEntries, ...inactiveEntries].map((e: any) => (
                <tr key={e.id} className={`hover:bg-muted/30 ${!e.active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 text-foreground font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-foreground">{e.role || "—"}</td>
                  <td className="px-3 py-2 text-foreground">{e.daily_rate ? formatCurrency(Number(e.daily_rate)) : "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatDate(e.start_date)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatDate(e.end_date)}</td>
                  <td className="px-3 py-2 text-foreground">{e.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${e.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {e.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => toggleActive.mutate({ id: e.id, active: !e.active })} className={`p-1 rounded ${e.active ? "hover:bg-accent text-amber-600" : "hover:bg-primary/10 text-primary"}`} title={e.active ? "Desativar" : "Ativar"}><Power className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(e.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit/New Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">{editing ? "Editar colaborador" : "Novo colaborador"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
                  <input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Função</label>
                  <select value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Diária (R$)</label>
                  <input type="number" step="0.01" value={form.daily_rate || ""} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data início</label>
                  <input type="date" value={form.start_date || ""} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data fim</label>
                  <input type="date" value={form.end_date || ""} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                  <input value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">CPF/Documento</label>
                  <input value={form.document || ""} onChange={e => setForm(p => ({ ...p, document: e.target.value }))} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                  <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
                </div>
                {editing && (
                  <div className="col-span-2 flex items-center gap-3">
                    <label className="text-sm font-medium text-foreground">Ativo?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={form.active === true} onChange={() => setForm(p => ({ ...p, active: true }))} className="accent-primary" /> Sim</label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={form.active === false} onChange={() => setForm(p => ({ ...p, active: false }))} className="accent-primary" /> Não</label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border bg-muted rounded-b-xl">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name?.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Plus className="h-4 w-4" /> {editing ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importOpen && (
        <LaborImportModal
          obraId={obraId}
          onClose={() => setImportOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ["obra_labor", obraId] })}
        />
      )}
    </div>
  );
}
