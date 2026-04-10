import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Trash2, ChevronDown, ChevronRight, Database, Loader2 } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const STATES = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const PRICING_TYPES = [
  { value: "sem_desoneracao", label: "Sem Desoneração" },
  { value: "com_desoneracao", label: "Com Desoneração" },
  { value: "sem_encargos", label: "Sem Encargos" },
];

export default function Sinapi() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("SP");
  const [filterPricing, setFilterPricing] = useState<string>("sem_desoneracao");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Load company settings to get default state/pricing
  const { data: companySettings } = useQuery({
    queryKey: ["company_settings_sinapi"],
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

  // Set defaults from company settings
  React.useEffect(() => {
    if (companySettings) {
      if (companySettings.state) setFilterState(companySettings.state);
      if (companySettings.sinapi_pricing_type) setFilterPricing(companySettings.sinapi_pricing_type);
    }
  }, [companySettings]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sinapi_items", search, filterType, filterCategory, filterState, filterPricing],
    queryFn: async () => {
      let query = supabase
        .from("sinapi_items")
        .select("*")
        .eq("state", filterState)
        .eq("pricing_type", filterPricing)
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

  // Count total default items for stats
  const { data: statsData } = useQuery({
    queryKey: ["sinapi_stats", filterState, filterPricing],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sinapi_items")
        .select("*", { count: "exact", head: true })
        .eq("state", filterState)
        .eq("pricing_type", filterPricing);
      if (error) throw error;
      return { total: count || 0 };
    },
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const categories = [...new Set(items.map((i: any) => i.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Base SINAPI</h1>
        </div>
        <div className="text-xs text-muted-foreground">
          Referência: 03/2026
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-foreground">
          📋 Base SINAPI pré-carregada com preços para <strong>27 estados</strong> e <strong>3 regimes de encargos</strong>. 
          Selecione abaixo o estado e regime desejado para visualizar os preços.
        </p>
      </div>

      {/* State & Pricing filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Estado:</label>
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={inputClass + " w-auto min-w-[100px]"}>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Regime:</label>
          <select value={filterPricing} onChange={(e) => setFilterPricing(e.target.value)} className={inputClass + " w-auto min-w-[180px]"}>
            {PRICING_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

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
        <span>{items.length} exibidos (máx. 100) — {statsData?.total || 0} total para {filterState} / {PRICING_TYPES.find(p => p.value === filterPricing)?.label}</span>
      </div>

      {/* Items table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum item SINAPI encontrado para {filterState} / {PRICING_TYPES.find(p => p.value === filterPricing)?.label}.</p>
          <p className="text-xs mt-1">Verifique os filtros ou tente outra busca.</p>
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
                      <td colSpan={8} className="px-8 py-3 bg-muted/20">
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
