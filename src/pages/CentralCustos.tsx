import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/utils/ccTags";
import {
  Building2, TrendingUp, Wallet, Target, AlertTriangle, Plus,
  Search, MapPin, ArrowRight, Activity, Sparkles,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type Obra = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  total_budget: number | null;
  active: boolean;
  category: string | null;
};

type Entry = {
  obra_id: string;
  valor_total: number;
  data: string;
  nome_item: string;
};

type Setting = {
  obra_id: string;
  orcamento_previsto: number | null;
  imagem_url: string | null;
  obra_publica: boolean | null;
};

export default function CentralCustos() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");

  const { data: obras = [] } = useQuery<Obra[]>({
    queryKey: ["cc-obras", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("obras")
        .select("id,name,city,state,status,total_budget,active,category")
        .eq("active", true)
        .order("created_at", { ascending: false });
      return (data || []) as Obra[];
    },
    enabled: !!user?.id,
  });

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["cc-entries-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_cost_entries" as any)
        .select("obra_id,valor_total,data,nome_item")
        .order("data", { ascending: true });
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ["cc-settings-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_obra_settings" as any)
        .select("obra_id,orcamento_previsto,imagem_url,obra_publica");
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const enriched = useMemo(() => {
    return obras.map((o) => {
      const ents = entries.filter((e) => e.obra_id === o.id);
      const gasto = ents.reduce((s, e) => s + Number(e.valor_total || 0), 0);
      const cfg = settings.find((s) => s.obra_id === o.id);
      const previsto = Number(cfg?.orcamento_previsto || o.total_budget || 0);
      const pct = previsto > 0 ? (gasto / previsto) * 100 : 0;
      const saude: "saudavel" | "atencao" | "risco" =
        pct >= 90 ? "risco" : pct >= 70 ? "atencao" : "saudavel";
      // sparkline: agregar por mês (últimos 6)
      const buckets: Record<string, number> = {};
      ents.forEach((e) => {
        const k = e.data?.slice(0, 7) || "";
        buckets[k] = (buckets[k] || 0) + Number(e.valor_total || 0);
      });
      const spark = Object.keys(buckets)
        .sort()
        .slice(-6)
        .map((k) => ({ v: buckets[k] }));
      const last = ents[ents.length - 1];
      return { obra: o, gasto, previsto, pct, saude, spark, last, cfg };
    });
  }, [obras, entries, settings]);

  const filtered = enriched.filter((e) => {
    if (search && !e.obra.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "todos" && e.saude !== statusFilter) return false;
    if (tipoFilter === "publica" && !e.cfg?.obra_publica) return false;
    if (tipoFilter === "privada" && e.cfg?.obra_publica) return false;
    return true;
  });

  const kpis = useMemo(() => {
    const ativas = enriched.length;
    const custoTotal = enriched.reduce((s, e) => s + e.gasto, 0);
    const orcTotal = enriched.reduce((s, e) => s + e.previsto, 0);
    const margem = orcTotal - custoTotal;
    const risco = enriched.filter((e) => e.saude === "risco").length;
    return { ativas, custoTotal, orcTotal, margem, risco };
  }, [enriched]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Novo módulo
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            Central de Custos
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle financeiro inteligente por obra
          </p>
        </div>
        <Link
          to="/obras"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/20 hover:opacity-90 transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" /> Nova Obra
        </Link>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-8">
        {[
          { icon: Building2, label: "Obras Ativas", value: kpis.ativas, fmt: false, color: "from-blue-500/10 to-blue-500/0", ico: "text-blue-500" },
          { icon: Wallet, label: "Custo Total", value: kpis.custoTotal, fmt: true, color: "from-rose-500/10 to-rose-500/0", ico: "text-rose-500" },
          { icon: Target, label: "Orçamento Previsto", value: kpis.orcTotal, fmt: true, color: "from-indigo-500/10 to-indigo-500/0", ico: "text-indigo-500" },
          { icon: TrendingUp, label: "Margem Estimada", value: kpis.margem, fmt: true, color: "from-emerald-500/10 to-emerald-500/0", ico: "text-emerald-500" },
          { icon: AlertTriangle, label: "Obras em Risco", value: kpis.risco, fmt: false, color: "from-amber-500/10 to-amber-500/0", ico: "text-amber-500" },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${k.color} pointer-events-none`} />
            <div className="relative">
              <div className={`inline-flex p-2 rounded-xl bg-background/60 backdrop-blur ${k.ico}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{k.label}</p>
              <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 tabular-nums">
                {k.fmt ? formatBRL(k.value as number) : k.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-3 lg:p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar obra..."
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-background text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 px-3 rounded-xl border border-border bg-background text-sm"
        >
          <option value="todos">Todos status</option>
          <option value="saudavel">Saudável</option>
          <option value="atencao">Atenção</option>
          <option value="risco">Risco</option>
        </select>
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="h-11 px-3 rounded-xl border border-border bg-background text-sm"
        >
          <option value="todos">Pública e Privada</option>
          <option value="publica">Pública</option>
          <option value="privada">Privada</option>
        </select>
      </div>

      {/* Cards de obras */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma obra encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e, i) => (
            <motion.div
              key={e.obra.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              {/* Imagem */}
              <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-muted overflow-hidden">
                {e.cfg?.imagem_url ? (
                  <img src={e.cfg.imagem_url} alt={e.obra.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                <span
                  className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur ${
                    e.saude === "saudavel"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : e.saude === "atencao"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <Activity className="h-3 w-3" />
                  {e.saude === "saudavel" ? "Saudável" : e.saude === "atencao" ? "Atenção" : "Risco"}
                </span>
              </div>

              <div className="p-5">
                <h3 className="font-semibold text-foreground text-lg truncate">{e.obra.name}</h3>
                {(e.obra.city || e.obra.state) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {[e.obra.city, e.obra.state].filter(Boolean).join(" / ")}
                  </p>
                )}

                {/* Barra de consumo */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Consumido</span>
                    <span className="font-semibold tabular-nums">{e.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        e.saude === "risco" ? "bg-rose-500" : e.saude === "atencao" ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, e.pct)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Gasto</p>
                    <p className="font-semibold tabular-nums">{formatBRL(e.gasto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previsto</p>
                    <p className="font-semibold tabular-nums">{formatBRL(e.previsto)}</p>
                  </div>
                </div>

                {/* Sparkline */}
                {e.spark.length > 1 && (
                  <div className="h-10 mt-3 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={e.spark}>
                        <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {e.last && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Último: <span className="text-foreground">{e.last.nome_item}</span>
                  </p>
                )}

                <Link
                  to={`/central-custos/${e.obra.id}`}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  Abrir Central <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
