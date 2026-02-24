import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  budgetId: string;
  onClose: () => void;
}

interface ParsedItem {
  phase: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

function normalizeHeader(h: any): string {
  if (!h) return "";
  return String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findCol(headers: string[], names: string[]): number {
  const nh = headers.map(normalizeHeader);
  const nn = names.map(normalizeHeader);
  for (const n of nn) {
    const i = nh.findIndex((h) => h === n);
    if (i !== -1) return i;
  }
  for (const n of nn) {
    const i = nh.findIndex((h) => h.startsWith(n));
    if (i !== -1) return i;
  }
  for (const n of nn) {
    const i = nh.findIndex((h) => h.includes(n));
    if (i !== -1) return i;
  }
  return -1;
}

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[R$\s]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function BudgetImportModal({ budgetId, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (rows.length < 2) {
          toast.error("Planilha vazia ou sem dados.");
          return;
        }

        const headers = rows[0].map(String);
        const iPhase = findCol(headers, ["fase", "fase da obra", "etapa", "fase/etapa"]);
        const iCode = findCol(headers, ["codigo", "cod", "item", "código"]);
        const iDesc = findCol(headers, ["descricao", "descrição", "servico", "serviço", "atividade"]);
        const iQty = findCol(headers, ["quantidade", "qtd", "quant"]);
        const iUnit = findCol(headers, ["unidade", "un", "und"]);
        const iPrice = findCol(headers, ["preco unitario", "valor unitario", "preco unit", "valor unit", "preço unitário", "valor unitário", "p. unit"]);
        const iTotal = findCol(headers, ["total", "preco total", "valor total", "preço total", "subtotal"]);

        if (iDesc === -1) {
          toast.error("Coluna de descrição não encontrada na planilha.");
          return;
        }

        const items: ParsedItem[] = [];
        let currentPhase = "Geral";

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const desc = String(row[iDesc] || "").trim();
          if (!desc) continue;

          if (iPhase !== -1 && row[iPhase]) {
            currentPhase = String(row[iPhase]).trim();
          }

          // Detect phase-only rows (description but no qty/price)
          const qty = iQty !== -1 ? parseNum(row[iQty]) : 0;
          const price = iPrice !== -1 ? parseNum(row[iPrice]) : 0;
          if (qty === 0 && price === 0 && iPhase === -1) {
            // Could be a phase header row
            const hasCode = iCode !== -1 && row[iCode];
            const codeStr = hasCode ? String(row[iCode]).trim() : "";
            // If it looks like "1 - PHASE NAME" or just a title row
            if (/^\d+\s*[-.]?\s*\w/.test(desc) && desc.length < 120) {
              currentPhase = desc;
              continue;
            }
          }

          const unitPrice = price;
          const total = iTotal !== -1 ? parseNum(row[iTotal]) : qty * unitPrice;

          items.push({
            phase: currentPhase,
            code: iCode !== -1 ? String(row[iCode] || "").trim() : "",
            description: desc,
            quantity: qty || 1,
            unit: iUnit !== -1 ? String(row[iUnit] || "un").trim() : "un",
            unit_price: unitPrice,
            total_price: total || qty * unitPrice,
          });
        }

        if (items.length === 0) {
          toast.error("Nenhum item válido encontrado na planilha.");
          return;
        }

        setParsedItems(items);
        setStep("preview");
      } catch (err) {
        toast.error("Erro ao ler a planilha. Verifique o formato do arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const phases = [...new Set(parsedItems.map((i) => i.phase))];

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    let success = 0;
    let errors = 0;

    // Batch insert
    const records = parsedItems.map((item, idx) => ({
      budget_id: budgetId,
      description: item.code ? `${item.code} - ${item.description}` : item.description,
      category: item.phase,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price,
      sort_order: idx,
    }));

    // Insert in batches of 50
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await supabase.from("budget_items").insert(batch as any);
      if (error) {
        errors += batch.length;
      } else {
        success += batch.length;
      }
    }

    setResult({ success, errors });
    setImporting(false);
    setStep("result");
    qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
    if (success > 0) toast.success(`${success} item(ns) importado(s)!`);
    if (errors > 0) toast.error(`${errors} item(ns) com erro.`);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar orçamento de planilha
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === "upload" && (
            <>
              <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Instruções</p>
                <p className="text-xs text-muted-foreground">
                  Importe uma planilha Excel (.xlsx, .xls) ou CSV com os itens do orçamento.
                  O sistema tentará identificar automaticamente as colunas: Fase, Descrição, Quantidade, Unidade, Preço Unitário e Total.
                  Os itens serão organizados por fase da obra.
                </p>
              </div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Selecione um arquivo Excel ou CSV</p>
                <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  Selecionar arquivo
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                </label>
                <p className="text-xs text-muted-foreground mt-3">Formatos: .xlsx, .xls, .csv</p>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{fileName}</span>
                <span className="text-muted-foreground">— {parsedItems.length} item(ns) em {phases.length} fase(s)</span>
                <button onClick={() => { setStep("upload"); setParsedItems([]); }} className="ml-auto text-xs text-primary hover:underline">Trocar arquivo</button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {phases.map((phase) => {
                  const phaseItems = parsedItems.filter((i) => i.phase === phase);
                  const phaseTotal = phaseItems.reduce((s, i) => s + i.total_price, 0);
                  return (
                    <div key={phase} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{phase}</span>
                        <span className="text-sm font-medium text-foreground">R$ {fmt(phaseTotal)}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Descrição</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Qtd</th>
                            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Un</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Preço Unit.</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {phaseItems.slice(0, 10).map((item, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-foreground">{item.description}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">{fmt(item.quantity)}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.unit}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">R$ {fmt(item.unit_price)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-foreground">R$ {fmt(item.total_price)}</td>
                            </tr>
                          ))}
                          {phaseItems.length > 10 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-1.5 text-center text-muted-foreground italic">
                                ... e mais {phaseItems.length - 10} item(ns)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Total geral: R$ {fmt(parsedItems.reduce((s, i) => s + i.total_price, 0))}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => { setStep("upload"); setParsedItems([]); }} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">Voltar</button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? "Importando..." : `Importar ${parsedItems.length} item(ns)`}
                </button>
              </div>
            </>
          )}

          {step === "result" && result && (
            <div className="space-y-4 text-center py-4">
              <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                result.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              }`}>
                {result.errors > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {result.success} importado(s), {result.errors} erro(s)
              </div>
              <div className="flex justify-center gap-3">
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
