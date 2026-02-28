import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Save, Power } from "lucide-react";

const BENEFIT_TYPES = [
  { value: "vale_refeicao", label: "Vale Refeição" },
  { value: "vale_alimentacao", label: "Vale Alimentação" },
  { value: "plano_saude", label: "Plano de Saúde" },
  { value: "plano_odonto", label: "Plano Odontológico" },
  { value: "seguro_vida", label: "Seguro de Vida" },
  { value: "cesta_basica", label: "Cesta Básica" },
  { value: "auxilio_creche", label: "Auxílio Creche" },
  { value: "gympass", label: "Gympass/Wellhub" },
  { value: "outros", label: "Outros" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function LaborBenefits({ laborId }: { laborId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["labor_benefits", laborId],
    queryFn: async () => {
      const { data, error } = await supabase.from("labor_benefits" as any).select("*").eq("labor_id", laborId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        const { error } = await supabase.from("labor_benefits" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labor_benefits" as any).insert({ ...values, labor_id: laborId, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_benefits", laborId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labor_benefits" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_benefits", laborId] }); toast.success("Removido!"); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("labor_benefits" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_benefits", laborId] }); toast.success("Atualizado!"); },
  });

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };
  const openNew = () => { setEditing(null); setForm({ benefit_type: "", description: "", value: "", discount_value: "", provider: "", start_date: "", end_date: "", notes: "" }); setFormOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ benefit_type: item.benefit_type, description: item.description || "", value: item.value || "", discount_value: item.discount_value || "", provider: item.provider || "", start_date: item.start_date || "", end_date: item.end_date || "", notes: item.notes || "" });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.benefit_type) { toast.error("Tipo é obrigatório"); return; }
    saveMutation.mutate({
      benefit_type: form.benefit_type,
      description: form.description || null,
      value: form.value ? Number(form.value) : 0,
      discount_value: form.discount_value ? Number(form.discount_value) : 0,
      provider: form.provider || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
    });
  };

  const getLabel = (val: string) => BENEFIT_TYPES.find(b => b.value === val)?.label || val;
  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Benefícios</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum benefício cadastrado.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-700 text-white">
              <th className="text-left px-2 py-2 font-semibold">Tipo</th>
              <th className="text-left px-2 py-2 font-semibold">Fornecedor</th>
              <th className="text-right px-2 py-2 font-semibold">Valor</th>
              <th className="text-right px-2 py-2 font-semibold">Desconto</th>
              <th className="text-center px-2 py-2 font-semibold">Status</th>
              <th className="text-center px-2 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-primary/10 ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                <td className="px-2 py-2 font-medium text-foreground">{getLabel(item.benefit_type)}</td>
                <td className="px-2 py-2 text-foreground">{item.provider || "—"}</td>
                <td className="px-2 py-2 text-right text-foreground">{item.value ? fmt(Number(item.value)) : "—"}</td>
                <td className="px-2 py-2 text-right text-foreground">{item.discount_value ? fmt(Number(item.discount_value)) : "—"}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    {item.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-0.5 justify-center">
                    <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-primary/10 text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })} className={`p-1 rounded ${item.active ? "hover:bg-accent text-amber-600" : "hover:bg-primary/10 text-primary"}`}><Power className="h-3.5 w-3.5" /></button>
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
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar benefício" : "Novo benefício"}</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Tipo *</label>
              <select value={form.benefit_type || ""} onChange={e => setForm(p => ({ ...p, benefit_type: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {BENEFIT_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.value || ""} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Desconto (R$)</label>
              <input type="number" step="0.01" value={form.discount_value || ""} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Fornecedor</label>
              <input value={form.provider || ""} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Início</label>
              <input type="date" value={form.start_date || ""} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Fim</label>
              <input type="date" value={form.end_date || ""} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
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
