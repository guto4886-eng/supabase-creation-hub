import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

const CHARGE_TYPES = [
  { value: "inss", label: "INSS" },
  { value: "fgts", label: "FGTS" },
  { value: "irrf", label: "IRRF" },
  { value: "vale_transporte", label: "Vale Transporte" },
  { value: "desconto_faltas", label: "Desconto Faltas" },
  { value: "contribuicao_sindical", label: "Contribuição Sindical" },
  { value: "pensao_alimenticia", label: "Pensão Alimentícia" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "outros", label: "Outros" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function LaborCharges({ laborId }: { laborId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["labor_charges", laborId],
    queryFn: async () => {
      const { data, error } = await supabase.from("labor_charges" as any).select("*").eq("labor_id", laborId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        const { error } = await supabase.from("labor_charges" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labor_charges" as any).insert({ ...values, labor_id: laborId, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_charges", laborId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labor_charges" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_charges", laborId] }); toast.success("Removido!"); },
  });

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };
  const openNew = () => { setEditing(null); setForm({ charge_type: "", description: "", percentage: "", fixed_value: "", reference_month: "", notes: "" }); setFormOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ charge_type: item.charge_type, description: item.description || "", percentage: item.percentage || "", fixed_value: item.fixed_value || "", reference_month: item.reference_month || "", notes: item.notes || "" }); setFormOpen(true); };

  const handleSubmit = () => {
    if (!form.charge_type) { toast.error("Tipo é obrigatório"); return; }
    saveMutation.mutate({
      charge_type: form.charge_type,
      description: form.description || null,
      percentage: form.percentage ? Number(form.percentage) : 0,
      fixed_value: form.fixed_value ? Number(form.fixed_value) : 0,
      reference_month: form.reference_month || null,
      notes: form.notes || null,
    });
  };

  const getLabel = (val: string) => CHARGE_TYPES.find(c => c.value === val)?.label || val;
  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Encargos Trabalhistas</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum encargo cadastrado.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-700 text-white">
              <th className="text-left px-2 py-2 font-semibold">Tipo</th>
              <th className="text-left px-2 py-2 font-semibold">Descrição</th>
              <th className="text-right px-2 py-2 font-semibold">%</th>
              <th className="text-right px-2 py-2 font-semibold">Valor Fixo</th>
              <th className="text-left px-2 py-2 font-semibold">Ref.</th>
              <th className="text-center px-2 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-primary/10 ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                <td className="px-2 py-2 font-medium text-foreground">{getLabel(item.charge_type)}</td>
                <td className="px-2 py-2 text-foreground">{item.description || "—"}</td>
                <td className="px-2 py-2 text-right text-foreground">{item.percentage ? `${item.percentage}%` : "—"}</td>
                <td className="px-2 py-2 text-right text-foreground">{item.fixed_value ? fmt(Number(item.fixed_value)) : "—"}</td>
                <td className="px-2 py-2 text-foreground">{item.reference_month || "—"}</td>
                <td className="px-2 py-2">
                  <div className="flex gap-0.5 justify-center">
                    <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-primary/10 text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar encargo" : "Novo encargo"}</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Tipo *</label>
              <select value={form.charge_type || ""} onChange={e => setForm(p => ({ ...p, charge_type: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {CHARGE_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Percentual (%)</label>
              <input type="number" step="0.01" value={form.percentage || ""} onChange={e => setForm(p => ({ ...p, percentage: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Valor fixo (R$)</label>
              <input type="number" step="0.01" value={form.fixed_value || ""} onChange={e => setForm(p => ({ ...p, fixed_value: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Descrição</label>
              <input value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Mês referência (YYYY-MM)</label>
              <input type="month" value={form.reference_month || ""} onChange={e => setForm(p => ({ ...p, reference_month: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Observações</label>
            <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 rounded border border-border bg-background text-foreground text-xs hover:bg-muted">Cancelar</button>
            <button onClick={handleSubmit} disabled={saveMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
