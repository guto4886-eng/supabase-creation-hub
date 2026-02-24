import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Props { obraId: string; form: Record<string, any>; setForm: (fn: (p: Record<string, any>) => Record<string, any>) => void; }

const DAYS = [
  { key: "dom", label: "Dom." },
  { key: "seg", label: "Seg." },
  { key: "ter", label: "Ter." },
  { key: "qua", label: "Qua." },
  { key: "qui", label: "Qui." },
  { key: "sex", label: "Sex." },
  { key: "sab", label: "Sáb." },
];

const COST_TYPES = ["Equipamentos", "Fretes", "Mão de obra", "Materiais", "Serviços", "Outros"];

const RDO_SECTIONS = [
  { key: "turno_tempo", label: "Turno/tempo" },
  { key: "tarefas_realizadas", label: "Tarefas realizadas" },
  { key: "imagens", label: "Imagens (pasta da obra)" },
  { key: "ocorrencias", label: "Ocorrências (dia a dia obra)" },
  { key: "equipe", label: "Equipe envolvida" },
  { key: "maquinas", label: "Máquinas e equipamentos" },
  { key: "materiais_recebidos", label: "Materiais recebidos" },
  { key: "materiais_utilizados", label: "Materiais utilizados" },
];

export default function ObraConfig({ obraId, form, setForm }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputClass = "px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const [rateType, setRateType] = useState<"custo" | "fase">("custo");

  const rdoSections: string[] = form.rdo_sections || RDO_SECTIONS.map(s => s.key);
  const toggleRdoSection = (key: string) => {
    const current = [...rdoSections];
    const idx = current.indexOf(key);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(key);
    setForm(p => ({ ...p, rdo_sections: current }));
  };

  const { data: rates = [] } = useQuery({
    queryKey: ["obra_admin_rates", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_admin_rates" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("cost_type");
      if (error) throw error;
      return data as any[];
    },
  });

  const [localRates, setLocalRates] = useState<Record<string, { percentage: number; fixed_value: number }>>({});

  useEffect(() => {
    const map: Record<string, { percentage: number; fixed_value: number }> = {};
    COST_TYPES.forEach(ct => {
      const existing = rates.find((r: any) => r.cost_type === ct);
      map[ct] = { percentage: existing?.percentage || 0, fixed_value: existing?.fixed_value || 0 };
    });
    setLocalRates(map);
  }, [rates]);

  const saveRatesMutation = useMutation({
    mutationFn: async () => {
      // Delete existing then insert all
      await supabase.from("obra_admin_rates" as any).delete().eq("obra_id", obraId);
      const inserts = COST_TYPES.map(ct => ({
        obra_id: obraId, user_id: user!.id, cost_type: ct,
        percentage: localRates[ct]?.percentage || 0,
        fixed_value: localRates[ct]?.fixed_value || 0,
      }));
      const { error } = await supabase.from("obra_admin_rates" as any).insert(inserts as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_admin_rates", obraId] });
      toast.success("Taxas salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const workDays: string[] = form.work_days || ["seg", "ter", "qua", "qui", "sex"];
  const toggleDay = (day: string) => {
    const current = [...workDays];
    const idx = current.indexOf(day);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(day);
    setForm(p => ({ ...p, work_days: current }));
  };

  return (
    <div className="p-5 space-y-5">
      {/* Tipo de faturamento */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Tipo de faturamento</label>
        <select value={form.billing_type || ""} onChange={e => setForm(p => ({ ...p, billing_type: e.target.value }))} className={inputClass + " flex-1"}>
          <option value="">Selecione...</option>
          <option value="taxa_administracao">Taxa de Administração</option>
          <option value="empreitada">Empreitada</option>
          <option value="preco_unitario">Preço Unitário</option>
        </select>
      </div>

      {/* Faturamento */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Faturamento</label>
        <div className="flex gap-4">
          {(["semanal", "quinzenal", "mensal"] as const).map(val => (
            <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={form.billing_frequency === val} onChange={() => setForm(p => ({ ...p, billing_frequency: val }))} className="accent-primary" />
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Tipo de documento */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Tipo de documento</label>
        <select value={form.document_type || ""} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} className={inputClass + " flex-1"}>
          <option value="">Selecione...</option>
          <option value="reembolso">Reembolso</option>
          <option value="nota_fiscal">Nota Fiscal</option>
          <option value="recibo">Recibo</option>
        </select>
      </div>

      {/* Planejamento */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Planejamento</label>
        <div className="flex gap-4">
          {(["semanal", "quinzenal", "mensal"] as const).map(val => (
            <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={form.planning_frequency === val} onChange={() => setForm(p => ({ ...p, planning_frequency: val }))} className="accent-primary" />
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Acompanhamento */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Acompanhamento</label>
        <div className="flex gap-4">
          {([["custo", "Pelo custo"], ["venda_taxas", "Pelo valor de venda+taxas"], ["ambos", "Ambos"]] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={form.tracking_method === val} onChange={() => setForm(p => ({ ...p, tracking_method: val }))} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Dias expediente */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Dias expediente</label>
        <div className="flex gap-3">
          {DAYS.map(d => (
            <label key={d.key} className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={workDays.includes(d.key)} onChange={() => toggleDay(d.key)} className="h-4 w-4 rounded border-input accent-primary" />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      {/* Controle de estoque */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Controle de estoque</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={!form.stock_control} onChange={() => setForm(p => ({ ...p, stock_control: false }))} className="accent-primary" /> Não
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={!!form.stock_control} onChange={() => setForm(p => ({ ...p, stock_control: true }))} className="accent-primary" /> Sim
          </label>
        </div>
      </div>
      {form.stock_control && (
        <div className="ml-40 pl-3 flex gap-4">
          {([["recebimento", "Apropriação por recebimento"], ["movimento", "Apropriação por movimento de estoque"]] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={form.stock_type === val} onChange={() => setForm(p => ({ ...p, stock_type: val }))} className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Acesso pelo cliente */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Acesso pelo cliente</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={!!form.client_access} onChange={() => setForm(p => ({ ...p, client_access: true }))} className="accent-primary" /> Sim
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" checked={!form.client_access} onChange={() => setForm(p => ({ ...p, client_access: false }))} className="accent-primary" /> Não
          </label>
        </div>
      </div>

      {/* Taxa de administração */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap w-40">Taxa de administração</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={rateType === "custo"} onChange={() => setRateType("custo")} className="accent-primary" /> Por tipo de custo
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={rateType === "fase"} onChange={() => setRateType("fase")} className="accent-primary" /> Por fase da obra
            </label>
          </div>
        </div>

        {rateType === "custo" && (
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo de custo</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Percentual (%)</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor Fixo (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COST_TYPES.map(ct => (
                <tr key={ct}>
                  <td className="px-3 py-2 text-foreground">{ct}</td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={localRates[ct]?.percentage || 0} onChange={e => setLocalRates(p => ({ ...p, [ct]: { ...p[ct], percentage: parseFloat(e.target.value) || 0 } }))} className={inputClass + " w-24 text-right ml-auto block"} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={localRates[ct]?.fixed_value || 0} onChange={e => setLocalRates(p => ({ ...p, [ct]: { ...p[ct], fixed_value: parseFloat(e.target.value) || 0 } }))} className={inputClass + " w-24 text-right ml-auto block"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* RDO - Relatório Diário de Obra */}
      <fieldset className="border border-border rounded-lg p-4 space-y-3">
        <legend className="px-2 text-sm font-bold text-foreground">RDO - Relatório Diário de Obra</legend>
        <p className="text-xs text-muted-foreground">Selecione as seções que devem ser exibidas no RDO dessa obra</p>
        <div className="space-y-2">
          {RDO_SECTIONS.map(s => (
            <label key={s.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={rdoSections.includes(s.key)}
                onChange={() => toggleRdoSection(s.key)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button onClick={() => saveRatesMutation.mutate()} disabled={saveRatesMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Save className="h-4 w-4" /> Salvar Configurações
        </button>
      </div>
    </div>
  );
}
