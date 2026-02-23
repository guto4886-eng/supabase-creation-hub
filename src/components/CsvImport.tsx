import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";

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

export default function CsvImport({ table, queryKey, fields, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
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

      // Auto-map columns by label or name match
      const autoMappings: FieldMapping[] = [];
      parsed.headers.forEach((h) => {
        const normalized = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = fields.find((f) => {
          const normLabel = f.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const normName = f.name.toLowerCase();
          return normLabel === normalized || normName === normalized || normLabel.includes(normalized) || normalized.includes(normLabel);
        });
        if (match) {
          autoMappings.push({ csvColumn: h, dbField: match.name });
        }
      });
      setMappings(autoMappings);
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
        if (idx >= 0 && row[idx]) {
          record[m.dbField] = row[idx];
        }
      });

      // Skip rows without required "name" field
      if (!record.name) {
        errors++;
        continue;
      }

      const { error } = await supabase.from(table as any).insert(record as any);
      if (error) {
        errors++;
      } else {
        success++;
      }
    }

    setResult({ success, errors });
    setImporting(false);
    if (success > 0) {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${success} registro(s) importado(s)!`);
    }
    if (errors > 0) {
      toast.error(`${errors} registro(s) com erro`);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!csvData ? (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Selecione um arquivo CSV ou clique para fazer upload
              </p>
              <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                Selecionar arquivo
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
              <p className="text-xs text-muted-foreground mt-3">Formatos aceitos: CSV (separado por vírgula ou ponto-e-vírgula)</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-foreground font-medium">{fileName}</span>
                <span className="text-muted-foreground">— {csvData.rows.length} linha(s)</span>
                <button onClick={() => { setCsvData(null); setMappings([]); setResult(null); }} className="ml-auto text-xs text-primary hover:underline">Trocar arquivo</button>
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

              {result && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {result.errors > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  {result.success} importado(s), {result.errors} erro(s)
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Cancelar</button>
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
        </div>
      </div>
    </div>
  );
}
