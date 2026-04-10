import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Upload, Trash2, FileSpreadsheet, ChevronDown, ChevronRight, Database, X, AlertTriangle, CheckCircle } from "lucide-react";
import * as XLSX from "xlsx-js-style";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

function normalizeHeader(h: any): string {
  if (!h) return "";
  return String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[R$\s]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export default function Sinapi() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sinapi_items", search, filterType, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("sinapi_items")
        .select("*")
        .order("code");

      if (search.trim()) {
        const s = search.trim();
        if (/^\d+$/.test(s)) {
          query = query.ilike("code", `%${s}%`);
        } else {
          query = query.ilike("description", `%${s}%`);
        }
      }
      if (filterType) query = query.eq("item_type", filterType);
      if (filterCategory) query = query.ilike("category", `%${filterCategory}%`);

      query = query.limit(100);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: compositions = [] } = useQuery({
    queryKey: ["sinapi_compositions", expandedItem],
    queryFn: async () => {
      if (!expandedItem) return [];
      const { data, error } = await supabase
        .from("sinapi_compositions")
        .select("*")
        .eq("sinapi_item_id", expandedItem)
        .order("component_code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!expandedItem,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sinapi_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinapi_items"] });
      toast.success("Item SINAPI removido!");
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("sinapi_items").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinapi_items"] });
      toast.success("Todos os itens SINAPI removidos!");
    },
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        let totalSuccess = 0;
        let totalErrors = 0;

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (rows.length < 2) continue;

          // Find header row
          let headerIdx = 0;
          for (let r = 0; r < Math.min(rows.length, 10); r++) {
            const nonEmpty = (rows[r] || []).filter((c: any) => c !== "" && c != null).length;
            if (nonEmpty >= 3) { headerIdx = r; break; }
          }

          const headers = (rows[headerIdx] || []).map((h: any) => normalizeHeader(h));
          
          // Find columns
          const findCol = (names: string[]) => {
            for (const n of names) {
              const i = headers.findIndex(h => h.includes(n));
              if (i !== -1) return i;
            }
            return -1;
          };

          const iCode = findCol(["codigo", "cod", "código"]);
          const iDesc = findCol(["descricao", "descrição", "composicao", "composição"]);
          const iUnit = findCol(["unidade", "un", "und"]);
          const iPrice = findCol(["preco", "preço", "valor", "custo"]);
          const iCategory = findCol(["classe", "grupo", "categoria", "capitulo", "capítulo"]);
          const iType = findCol(["tipo"]);
          const iState = findCol(["estado", "uf"]);
          const iRef = findCol(["referencia", "referência", "data ref", "mes ref"]);

          if (iCode === -1 || iDesc === -1) {
            toast.error(`Aba "${sheetName}": Colunas código e descrição não encontradas.`);
            continue;
          }

          const records: any[] = [];
          for (let r = headerIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const code = String(row[iCode] || "").trim();
            const desc = String(row[iDesc] || "").trim();
            if (!code || !desc) continue;

            records.push({
              user_id: user.id,
              code,
              description: desc,
              unit: iUnit !== -1 ? String(row[iUnit] || "un").trim() || "un" : "un",
              unit_price: iPrice !== -1 ? parseNum(row[iPrice]) : 0,
              category: iCategory !== -1 ? String(row[iCategory] || "").trim() : null,
              item_type: iType !== -1 ? (normalizeHeader(row[iType]).includes("comp") ? "composição" : "insumo") : "insumo",
              state: iState !== -1 ? String(row[iState] || "SP").trim() : "SP",
              reference_date: iRef !== -1 && row[iRef] ? String(row[iRef]).trim() : null,
              is_default: false,
            });
          }

          // Insert in batches
          for (let i = 0; i < records.length; i += 50) {
            const batch = records.slice(i, i + 50);
            const { error } = await supabase.from("sinapi_items").insert(batch as any);
            if (error) {
              totalErrors += batch.length;
              console.error("[SINAPI Import]", error.message);
            } else {
              totalSuccess += batch.length;
            }
          }
        }

        setImportResult({ success: totalSuccess, errors: totalErrors });
        if (totalSuccess > 0) toast.success(`${totalSuccess} item(ns) SINAPI importado(s)!`);
        if (totalErrors > 0) toast.error(`${totalErrors} item(ns) com erro.`);
        qc.invalidateQueries({ queryKey: ["sinapi_items"] });
      } catch (err) {
        toast.error("Erro ao processar planilha SINAPI.");
        console.error(err);
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const categories = [...new Set(items.map(i => (i as any).category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Base SINAPI</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Upload className="h-4 w-4" /> Importar planilha
          </button>
          {items.length > 0 && (
            <button
              onClick={() => { if (confirm("Remover TODOS os itens SINAPI importados?")) deleteAll.mutate(); }}
              className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Limpar base
            </button>
          )}
        </div>
      </div>

      {/* Import area */}
      {showImport && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">📋 Instruções de importação SINAPI</p>
            <p className="text-xs text-muted-foreground">
              Importe a planilha SINAPI oficial (.xlsx, .xls, .csv). O sistema identifica automaticamente as colunas: 
              Código, Descrição, Unidade, Preço, Classe/Categoria, Tipo (Insumo/Composição), Estado e Data de Referência.
              Todas as abas da planilha serão processadas.
            </p>
          </div>

          {!importing && !importResult && (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Selecione a planilha SINAPI</p>
              <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                Selecionar arquivo
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
              </label>
            </div>
          )}

          {importing && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Importando itens SINAPI...</span>
            </div>
          )}

          {importResult && (
            <div className="space-y-3 text-center py-4">
              <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                importResult.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              }`}>
                {importResult.errors > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {importResult.success} importado(s), {importResult.errors} erro(s)
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => { setImportResult(null); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Importar mais</button>
                <button onClick={() => setShowImport(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Concluir</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className={inputClass + " pl-9"}
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputClass + " w-auto min-w-[150px]"}>
          <option value="">Todos os tipos</option>
          <option value="insumo">Insumo</option>
          <option value="composição">Composição</option>
        </select>
        {categories.length > 0 && (
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClass + " w-auto min-w-[180px]"}>
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{items.length} item(ns) exibidos (máx. 100)</span>
      </div>

      {/* Items table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum item SINAPI encontrado.</p>
          <p className="text-xs mt-1">Importe uma planilha SINAPI para começar.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-700 text-white">
                <th className="text-left px-4 py-2.5 font-medium w-8"></th>
                <th className="text-left px-4 py-2.5 font-medium">Código</th>
                <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                <th className="text-left px-4 py-2.5 font-medium">Un</th>
                <th className="text-right px-4 py-2.5 font-medium">Preço Unit.</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
                <th className="text-left px-4 py-2.5 font-medium">UF</th>
                <th className="text-center px-4 py-2.5 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {item.item_type === "composição" && (
                        <button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className="text-muted-foreground hover:text-foreground">
                          {expandedItem === item.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-primary">{item.code}</td>
                    <td className="px-4 py-2 text-foreground max-w-[400px] truncate" title={item.description}>{item.description}</td>
                    <td className="px-4 py-2 text-muted-foreground uppercase">{item.unit}</td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">R$ {fmt(item.unit_price)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.item_type === "composição" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"}`}>
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{item.category || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{item.state || "—"}</td>
                    <td className="px-4 py-2 text-center">
                      {!item.is_default && (
                        <button onClick={() => { if (confirm("Remover item?")) deleteItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedItem === item.id && compositions.length > 0 && (
                    <tr>
                      <td colSpan={9} className="px-8 py-3 bg-muted/20">
                        <p className="text-xs font-semibold text-primary mb-2">Composição — Insumos componentes</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left py-1 px-2">Código</th>
                              <th className="text-left py-1 px-2">Descrição</th>
                              <th className="text-left py-1 px-2">Un</th>
                              <th className="text-right py-1 px-2">Coeficiente</th>
                              <th className="text-right py-1 px-2">Preço Unit.</th>
                              <th className="text-right py-1 px-2">Custo Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {compositions.map((c: any) => (
                              <tr key={c.id}>
                                <td className="py-1 px-2 font-mono">{c.component_code}</td>
                                <td className="py-1 px-2">{c.component_description}</td>
                                <td className="py-1 px-2 text-muted-foreground uppercase">{c.component_unit}</td>
                                <td className="py-1 px-2 text-right">{fmt(c.coefficient)}</td>
                                <td className="py-1 px-2 text-right">R$ {fmt(c.component_price)}</td>
                                <td className="py-1 px-2 text-right font-medium">R$ {fmt(c.coefficient * c.component_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
