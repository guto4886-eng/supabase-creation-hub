import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Search, Database, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  onSelect: (item: { code: string; description: string; unit: string; unit_price: number }) => void;
  onClose: () => void;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const PRICING_TYPES = [
  { value: "sem_desoneracao", label: "Sem Desoneração" },
  { value: "com_desoneracao", label: "Com Desoneração" },
  { value: "sem_encargos", label: "Sem Encargos" },
];

export default function SinapiSearchModal({ onSelect, onClose }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [filterState, setFilterState] = useState("SP");
  const [filterPricing, setFilterPricing] = useState("sem_desoneracao");

  // Load company settings for default state/pricing
  const { data: companySettings } = useQuery({
    queryKey: ["company_settings_sinapi_modal"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("company_settings")
        .select("state, sinapi_pricing_type")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (companySettings) {
      if (companySettings.state) setFilterState(companySettings.state);
      if (companySettings.sinapi_pricing_type) setFilterPricing(companySettings.sinapi_pricing_type);
    }
  }, [companySettings]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sinapi_search", search, filterType, filterState, filterPricing],
    queryFn: async () => {
      let query = supabase
        .from("sinapi_items")
        .select("*")
        .eq("state", filterState)
        .eq("pricing_type", filterPricing)
        .order("code")
        .limit(100);

      const s = search.trim();
      if (s) {
        if (/^\d+$/.test(s)) {
          query = query.ilike("code", `%${s}%`);
        } else {
          query = query.ilike("description", `%${s}%`);
        }
      }

      if (filterType) query = query.eq("item_type", filterType);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
...
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!search.trim() && !isLoading && items.length > 0 && (
            <p className="pb-3 text-xs text-muted-foreground">
              Exibindo os primeiros 100 itens para {filterState} / {PRICING_TYPES.find((p) => p.value === filterPricing)?.label}.
              Digite código ou descrição para refinar a busca.
            </p>
          )}

          {isLoading ? (
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
