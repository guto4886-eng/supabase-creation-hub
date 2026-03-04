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

function sanitizeText(v: any, fallback = ""): string {
  return String(v ?? fallback).replace(/\u0000/g, "").trim();
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

        // Find the header row (first row with 3+ non-empty text cells)
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const nonEmpty = (rows[r] || []).filter((c: any) => c !== "" && c != null).length;
          if (nonEmpty >= 3) {
            headerRowIdx = r;
            break;
          }
        }

        const headers = (rows[headerRowIdx] || []).map(String);
        console.log("[BudgetImport] Headers found at row", headerRowIdx, ":", headers);

        // More flexible column detection with many aliases
        const iDesc = findCol(headers, ["descricao", "descrição", "servico", "serviço", "atividade", "composicao", "composição", "discriminacao", "discriminação", "especificacao", "especificação"]);
        const iPhase = findCol(headers, ["fase", "fase da obra", "etapa", "fase/etapa", "grupo", "capitulo", "capítulo"]);
        const iIndex = findCol(headers, ["indice", "índice", "index", "item", "cod", "codigo", "código", "cod.", "num", "ref", "id"]);
        const iQty = findCol(headers, ["quantidade", "qtd", "quant", "qtde", "qtd.", "quant."]);
        const iUnit = findCol(headers, ["unidade", "un", "und", "un.", "und.", "unid"]);
        const iPrice = findCol(headers, ["preco unitario", "valor unitario", "preco unit", "valor unit", "preço unitário", "valor unitário", "p. unit", "p.unit", "p unit", "custo unitario", "custo unit", "preco", "preço", "vlr unit", "vlr. unit"]);

        console.log("[BudgetImport] Column indices - desc:", iDesc, "phase:", iPhase, "index:", iIndex, "qty:", iQty, "unit:", iUnit, "price:", iPrice);

        // If no description column found, try to use the first text-heavy column
        let descIdx = iDesc;
        if (descIdx === -1) {
          let bestCol = -1;
          let bestAvgLen = 0;
          for (let c = 0; c < headers.length; c++) {
            if (c === iQty || c === iUnit || c === iPrice || c === iIndex) continue;
            let totalLen = 0;
            let count = 0;
            for (let r = headerRowIdx + 1; r < Math.min(rows.length, headerRowIdx + 20); r++) {
              const val = String(rows[r]?.[c] || "").trim();
              if (val) { totalLen += val.length; count++; }
            }
            const avgLen = count > 0 ? totalLen / count : 0;
            if (avgLen > bestAvgLen) {
              bestAvgLen = avgLen;
              bestCol = c;
            }
          }
          if (bestCol !== -1 && bestAvgLen > 5) {
            descIdx = bestCol;
            console.log("[BudgetImport] Auto-detected description column:", bestCol, "header:", headers[bestCol]);
          }
        }

        if (descIdx === -1) {
          toast.error("Coluna de descrição não encontrada. Headers: " + headers.slice(0, 8).join(", "));
          return;
        }

        const items: ParsedItem[] = [];
        let currentPhase = "Geral";

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.every((c: any) => c === "" || c == null)) continue;
          
          const desc = String(row[descIdx] || "").trim();
          if (!desc) continue;

          // Read the index column to detect phases/subphases
          const indexVal = iIndex !== -1 ? String(row[iIndex] || "").trim() : "";

          // Read phase column if available
          if (iPhase !== -1 && row[iPhase]) {
            currentPhase = String(row[iPhase]).trim();
          }

          const qty = iQty !== -1 ? parseNum(row[iQty]) : 0;
          const price = iPrice !== -1 ? parseNum(row[iPrice]) : 0;

          // Use index to detect phase hierarchy: "1" or "1." = phase, "1.1" = subphase
          // Skip phase/subphase rows regardless of whether they have values (avoids double-counting subtotals)
          if (indexVal && iPhase === -1) {
            const cleanIdx = indexVal.replace(/\.$/, "");
            const parts = cleanIdx.split(".");
            if (parts.length <= 2 && parts.every((p) => /^\d+$/.test(p))) {
              // Always treat 1-level and 2-level indices as potential phase/subphase headers
              // They'll be confirmed as parents in post-processing; for now mark as phase
              currentPhase = `${indexVal} - ${desc}`;
              // Only skip if no qty/price OR if it's a single-level index (always a phase)
              if (parts.length === 1 || (qty === 0 && price === 0)) {
                continue;
              }
              // 2-level with values: keep in items but mark code for post-processing removal
            }
          }

          // Fallback phase detection from description
          if (!indexVal && qty === 0 && price === 0 && iPhase === -1) {
            if (/^\d+[\s.\-]/.test(desc) && desc.length < 120) {
              currentPhase = desc;
              continue;
            }
          }

          // Total is always calculated: qty * unit_price
          const total = (qty || 1) * price;

          items.push({
            phase: currentPhase,
            code: indexVal,
            description: desc,
            quantity: qty || 1,
            unit: iUnit !== -1 ? String(row[iUnit] || "un").trim() || "un" : "un",
            unit_price: price,
            total_price: total,
          });
        }

        // Post-process Step 1: detect subtotal/phase rows by checking if a row's total
        // matches the sum of consecutive following rows (regardless of codes)
        // This identifies phase headers even without an index column
        const subtotalIndices = new Set<number>();
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.total_price <= 0) continue;
          // Try summing consecutive items after this one
          let runningSum = 0;
          let matchEnd = -1;
          for (let j = i + 1; j < items.length; j++) {
            runningSum += items[j].total_price;
            // Check if running sum matches this item's total (within 2% tolerance)
            if (runningSum > 0 && Math.abs(item.total_price - runningSum) / runningSum < 0.02) {
              matchEnd = j;
              break;
            }
            // If sum exceeds item total, stop
            if (runningSum > item.total_price * 1.02) break;
          }
          if (matchEnd > i) {
            // This item is a subtotal/phase header — assign its description as phase to children
            const phaseName = item.code ? `${item.code} - ${item.description}` : item.description;
            console.log("[BudgetImport] Detected phase row:", phaseName, "total:", item.total_price, "children:", matchEnd - i);
            subtotalIndices.add(i);
            for (let j = i + 1; j <= matchEnd; j++) {
              // Only override phase if children don't already have a meaningful phase
              if (items[j].phase === "Geral" || items[j].phase === item.phase) {
                items[j].phase = phaseName;
              }
            }
          }
        }

        // Post-process Step 2: remove parent/phase rows by code prefix
        const allCodes = items.map((it) => it.code.replace(/\.$/, "")).filter(Boolean);
        const finalItems = items.filter((item, idx) => {
          // Remove subtotal rows detected above
          if (subtotalIndices.has(idx)) return false;
          // Remove parent rows by code prefix
          if (item.code) {
            const cleanCode = item.code.replace(/\.$/, "");
            const parts = cleanCode.split(".");
            if (parts.length <= 2 && parts.every((p) => /^\d+$/.test(p))) {
              const isParent = allCodes.some((c) => c !== cleanCode && c.startsWith(cleanCode + "."));
              if (isParent) {
                console.log("[BudgetImport] Removing parent row by code:", item.code, item.description);
                return false;
              }
            }
          }
          return true;
        });

        console.log("[BudgetImport] Parsed items:", finalItems.length, "(removed", items.length - finalItems.length, "phase/subtotal rows)");

        if (finalItems.length === 0) {
          toast.error("Nenhum item válido encontrado. Headers detectados: " + headers.slice(0, 8).join(", "));
          return;
        }

        setParsedItems(finalItems);
        setStep("preview");
      } catch (err) {
        toast.error("Erro ao ler a planilha. Verifique o formato do arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const phases = [...new Set(parsedItems.map((i) => i.phase))];

  const handleImport = async () => {
    if (!user) {
      toast.error("Sua sessão expirou. Faça login novamente para importar.");
      return;
    }
    if (parsedItems.length === 0) {
      toast.error("Nenhum item disponível para importar.");
      return;
    }

    setImporting(true);
    let success = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    // Build records: first insert phase rows (category="fase"), then service rows (category="serviço")
    const records: any[] = [];
    let sortIdx = 0;

    // Collect unique phases in order of appearance
    const seenPhases = new Set<string>();
    const orderedPhases: string[] = [];
    for (const item of parsedItems) {
      const phaseName = sanitizeText(item.phase, "Geral") || "Geral";
      if (!seenPhases.has(phaseName)) {
        seenPhases.add(phaseName);
        orderedPhases.push(phaseName);
      }
    }

    // Insert phase rows with category "fase"
    for (const phaseName of orderedPhases) {
      const phaseTotal = parsedItems
        .filter((i) => (sanitizeText(i.phase, "Geral") || "Geral") === phaseName)
        .reduce((sum, i) => sum + i.total_price, 0);
      records.push({
        budget_id: budgetId,
        description: phaseName,
        category: "fase",
        quantity: 1,
        unit: "vb",
        unit_price: phaseTotal,
        sort_order: sortIdx++,
      });
    }

    // Insert service rows with category "serviço"
    for (const item of parsedItems) {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0;
      const description = sanitizeText(item.description);
      const code = sanitizeText(item.code);

      records.push({
        budget_id: budgetId,
        description: code ? `${code} - ${description}` : description,
        category: "serviço",
        quantity,
        unit: sanitizeText(item.unit, "un") || "un",
        unit_price: unitPrice,
        sort_order: sortIdx++,
      });
    }

    // Insert in batches of 50 (with row fallback for detailed errors)
    for (let i = 0; i < records.length; i += 50) {
      const batch = records.slice(i, i + 50);
      const { error } = await supabase.from("budget_items").insert(batch as any);

      if (!error) {
        success += batch.length;
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const { error: rowError } = await supabase.from("budget_items").insert(row as any);
        if (rowError) {
          errors += 1;
          if (errorMessages.length < 5) {
            errorMessages.push(`Item ${i + j + 1}: ${rowError.message}`);
          }
        } else {
          success += 1;
        }
      }
    }

    setResult({ success, errors });
    setImporting(false);
    setStep("result");
    qc.invalidateQueries({ queryKey: ["budget_items", budgetId] });
    qc.invalidateQueries({ queryKey: ["budgets"] });

    if (success > 0) toast.success(`${success} item(ns) importado(s)!`);
    if (errors > 0) {
      const detail = errorMessages[0] ? ` ${errorMessages[0]}` : "";
      toast.error(`${errors} item(ns) com erro.${detail}`);
      console.error("[BudgetImport] Import errors:", errorMessages);
    }
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
