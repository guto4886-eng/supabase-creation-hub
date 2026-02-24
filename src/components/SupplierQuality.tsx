import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Star } from "lucide-react";

interface Props {
  supplierId: string;
}

const CRITERIA = [
  "Qualidade do produto", "Prazo de entrega", "Atendimento", "Preço",
  "Condições de pagamento", "Pós-venda", "Documentação",
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} className={`p-0.5 ${n <= value ? "text-amber-400" : "text-muted-foreground/30"}`}>
          <Star className="h-4 w-4 fill-current" />
        </button>
      ))}
    </div>
  );
}

export default function SupplierQuality({ supplierId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supplier_quality_ratings", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_quality_ratings").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier_id: supplierId,
        user_id: user!.id,
        criterion: form.criterion,
        rating: form.rating || 5,
        evaluation_date: form.evaluation_date || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("supplier_quality_ratings").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_quality_ratings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_quality_ratings", supplierId] });
      toast.success(editing ? "Atualizado!" : "Avaliação adicionada!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_quality_ratings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_quality_ratings", supplierId] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ rating: 5, evaluation_date: new Date().toISOString().slice(0, 10) }); setFormOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  const avg = items.length > 0 ? (items.reduce((s: number, i: any) => s + i.rating, 0) / items.length).toFixed(1) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-foreground">Avaliação de Qualidade</h4>
          {avg && <span className="text-xs bg-amber-400/20 text-amber-600 px-2 py-0.5 rounded-full font-medium">Média: {avg} ⭐</span>}
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          <Plus className="h-3.5 w-3.5" /> Nova avaliação
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação registrada</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30"><th className="text-left px-3 py-2 text-muted-foreground font-medium">Critério</th><th className="text-center px-3 py-2 text-muted-foreground font-medium">Nota</th><th className="text-left px-3 py-2 text-muted-foreground font-medium">Data</th><th className="text-left px-3 py-2 text-muted-foreground font-medium">Obs.</th><th className="w-20 px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-border">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground">{item.criterion}</td>
                <td className="px-3 py-2 text-center"><StarRating value={item.rating} onChange={() => {}} /></td>
                <td className="px-3 py-2 text-muted-foreground">{item.evaluation_date ? new Date(item.evaluation_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.notes || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm("Remover?")) remove.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar" : "Nova"} avaliação</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Critério *</label>
              <select value={form.criterion || ""} onChange={e => setForm(p => ({ ...p, criterion: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {CRITERIA.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="outro">Outro...</option>
              </select>
              {form.criterion === "outro" && <input value={form.custom_criterion || ""} onChange={e => setForm(p => ({ ...p, criterion: e.target.value }))} placeholder="Digite o critério" className={inputClass + " mt-1"} />}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nota</label>
              <StarRating value={form.rating || 5} onChange={v => setForm(p => ({ ...p, rating: v }))} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Data</label>
              <input type="date" value={form.evaluation_date || ""} onChange={e => setForm(p => ({ ...p, evaluation_date: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div><label className="block text-xs text-muted-foreground mb-1">Observações</label><input value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} /></div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => { if (!form.criterion?.trim()) { toast.error("Critério obrigatório"); return; } save.mutate(); }} disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
