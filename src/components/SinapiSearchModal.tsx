import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Search, Database, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  onSelect: (item: { code: string; description: string; unit: string; unit_price: number }) => void;
  onClose: () => void;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function SinapiSearchModal({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sinapi_search", search, filterType],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      let query = supabase
        .from("sinapi_items")
        .select("*")
        .order("code")
        .limit(50);

      const s = search.trim();
      if (/^\d+$/.test(s)) {
        query = query.ilike("code", `%${s}%`);
      } else {
        query = query.ilike("description", `%${s}%`);
      }
      if (filterType) query = query.eq("item_type", filterType);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: search.trim().length >= 2,
  });

  const { data: compositions = [] } = useQuery({
    queryKey: ["sinapi_comp_search", expandedItem],
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

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Buscar na base SINAPI
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Digite código ou descrição (mín. 2 caracteres)..."
                className={inputClass + " pl-9"}
              />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputClass + " w-auto min-w-[140px]"}>
              <option value="">Todos</option>
              <option value="insumo">Insumo</option>
              <option value="composição">Composição</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {search.trim().length < 2 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar.</p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhum item encontrado.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-8 px-3 py-2"></th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Código</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Un</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Preço Unit.</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="w-20 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item: any) => (
                    <>
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          {item.item_type === "composição" && (
                            <button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className="text-muted-foreground hover:text-foreground">
                              {expandedItem === item.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-primary">{item.code}</td>
                        <td className="px-3 py-2 text-foreground text-xs max-w-[300px]" title={item.description}>{item.description}</td>
                        <td className="px-3 py-2 text-muted-foreground uppercase text-xs">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-medium text-xs">R$ {fmt(item.unit_price)}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${item.item_type === "composição" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"}`}>
                            {item.item_type}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => onSelect({ code: item.code, description: item.description, unit: item.unit, unit_price: item.unit_price })}
                            className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90"
                          >
                            Usar
                          </button>
                        </td>
                      </tr>
                      {expandedItem === item.id && compositions.length > 0 && (
                        <tr key={item.id + "-comp"}>
                          <td colSpan={7} className="px-6 py-2 bg-muted/20">
                            <p className="text-xs font-semibold text-primary mb-1">Composição</p>
                            <div className="space-y-0.5">
                              {compositions.map((c: any) => (
                                <div key={c.id} className="flex gap-4 text-xs text-muted-foreground">
                                  <span className="font-mono w-20">{c.component_code}</span>
                                  <span className="flex-1">{c.component_description}</span>
                                  <span className="w-10 uppercase">{c.component_unit}</span>
                                  <span className="w-16 text-right">{fmt(c.coefficient)}</span>
                                  <span className="w-24 text-right">R$ {fmt(c.component_price)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
