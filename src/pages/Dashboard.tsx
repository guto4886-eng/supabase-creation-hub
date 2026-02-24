import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Truck, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: obras } = useQuery({
    queryKey: ["obras-count"],
    queryFn: async () => {
      const { count } = await supabase.from("obras").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-count"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-count"],
    queryFn: async () => {
      const { count } = await supabase.from("suppliers").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: financialSummary } = useQuery({
    queryKey: ["financial-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_docs").select("type, value, status");
      const receitas = (data ?? []).filter((d) => d.type === "receita").reduce((s, d) => s + Number(d.value), 0);
      const despesas = (data ?? []).filter((d) => d.type === "despesa").reduce((s, d) => s + Number(d.value), 0);
      const pendentes = (data ?? []).filter((d) => d.status === "pendente").length;
      return { receitas, despesas, pendentes };
    },
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visão Geral</h2>
        <p className="text-muted-foreground">Resumo das suas obras e finanças</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Obras ativas" value={obras ?? 0} icon={Building2} color="bg-primary/10 text-primary" />
        <StatCard label="Clientes" value={clients ?? 0} icon={Users} color="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="Fornecedores" value={suppliers ?? 0} icon={Truck} color="bg-amber-500/10 text-amber-600" />
        <StatCard label="Docs pendentes" value={financialSummary?.pendentes ?? 0} icon={DollarSign} color="bg-rose-500/10 text-rose-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Receitas</span>
          </div>
          <p className="text-3xl font-bold text-card-foreground">{fmt(financialSummary?.receitas ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-rose-600">
            <TrendingDown className="h-5 w-5" />
            <span className="text-sm font-medium">Despesas</span>
          </div>
          <p className="text-3xl font-bold text-card-foreground">{fmt(financialSummary?.despesas ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}
