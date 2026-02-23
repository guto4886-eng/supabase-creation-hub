import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle, Download } from "lucide-react";

interface FieldMapping {
  csvColumn: string;
  dbField: string;
}

interface Props {
  table: string;
  queryKey: string;
  fields: { name: string; label: string }[];
  onClose: () => void;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === "," || char === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c));
  return { headers, rows };
}

function generateTemplate(fields: { name: string; label: string }[]): void {
  const BOM = "\uFEFF";
  const csv = BOM + fields.map((f) => f.label).join(";");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Step = "upload" | "mapping" | "result";

export default function CsvImport({ table, queryKey, fields, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);

      // Auto-map columns
      const autoMappings: FieldMapping[] = [];
      parsed.headers.forEach((h) => {
        const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = fields.find((f) => {
          const normLabel = f.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const normName = f.name.toLowerCase();
          return normLabel === normalized || normName === normalized || normLabel.includes(normalized) || normalized.includes(normLabel);
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
    let success = 0;
    let errors = 0;

    for (const row of csvData.rows) {
      const record: Record<string, any> = { user_id: user.id };
      mappings.forEach((m) => {
        const idx = csvData.headers.indexOf(m.csvColumn);
        if (idx >= 0 && row[idx]) record[m.dbField] = row[idx];
      });
      if (!record.name) { errors++; continue; }

      const { error } = await supabase.from(table as any).insert(record as any);
      if (error) errors++;
      else success++;
    }

    setResult({ success, errors });
    setImporting(false);
    setStep("result");
    if (success > 0) {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${success} registro(s) importado(s)!`);
    }
    if (errors > 0) toast.error(`${errors} registro(s) com erro`);
  };

  const resetImport = () => {
    setCsvData(null);
    setMappings([]);
    setResult(null);
    setStep("upload");
    setFileName("");
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importador de dados de planilha
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === "upload" ? "text-primary font-medium" : ""}>1. Upload</span>
            <span>→</span>
            <span className={step === "mapping" ? "text-primary font-medium" : ""}>2. Mapeamento</span>
            <span>→</span>
            <span className={step === "result" ? "text-primary font-medium" : ""}>3. Resultado</span>
          </div>

          {/* Step 1: Upload */}
          {step === "upload" && (
            <>
              <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Instruções</p>
                <p className="text-xs text-muted-foreground">
                  Para importar dados é necessário utilizar a planilha padrão de importação.
                  Faça o download do modelo abaixo, preencha com seus dados e importe na próxima etapa.
                </p>
                <button
                  onClick={() => generateTemplate(fields)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar planilha modelo
                </button>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione um arquivo CSV ou clique para fazer upload
                </p>
                <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Selecionar arquivo
                  <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx" onChange={handleFile} className="hidden" />
                </label>
                <p className="text-xs text-muted-foreground mt-3">Formatos aceitos: CSV (separado por vírgula ou ponto-e-vírgula)</p>
              </div>
            </>
          )}

          {/* Step 2: Mapping */}
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
                <p className="text-xs text-muted-foreground">Vincule as colunas do arquivo aos campos do sistema</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {csvData.headers.map((h) => {
                    const mapping = mappings.find((m) => m.csvColumn === h);
                    return (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-sm text-foreground w-40 truncate font-mono bg-muted/50 px-2 py-1 rounded">{h}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <select value={mapping?.dbField ?? ""} onChange={(e) => updateMapping(h, e.target.value)} className={inputClass + " flex-1"}>
                          <option value="">Ignorar</option>
                          {fields.map((f) => (
                            <option key={f.name} value={f.name} disabled={mappings.some((m) => m.dbField === f.name && m.csvColumn !== h)}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {csvData.rows.length > 0 && mappings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Pré-visualização (primeiros 3 registros)</h4>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          {mappings.map((m) => (
                            <th key={m.dbField} className="px-3 py-2 text-left font-medium text-muted-foreground">
                              {fields.find((f) => f.name === m.dbField)?.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvData.rows.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {mappings.map((m) => {
                              const idx = csvData.headers.indexOf(m.csvColumn);
                              return <td key={m.dbField} className="px-3 py-2 text-foreground">{idx >= 0 ? row[idx] : "—"}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={resetImport} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Voltar</button>
                <button
                  onClick={handleImport}
                  disabled={importing || mappings.length === 0}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? "Importando..." : `Importar ${csvData.rows.length} registro(s)`}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Result */}
          {step === "result" && result && (
            <div className="space-y-4 text-center py-4">
              <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                result.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              }`}>
                {result.errors > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {result.success} importado(s), {result.errors} erro(s)
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={resetImport} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">
                  Nova importação
                </button>
                <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
