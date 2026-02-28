import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function LaborAllocations({ laborId }: { laborId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["labor_allocations", laborId],
    queryFn: async () => {
      const { data, error } = await supabase.from("labor_allocations" as any).select("*").eq("labor_id", laborId).order("start_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        const { error } = await supabase.from("labor_allocations" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labor_allocations" as any).insert({ ...values, labor_id: laborId, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_allocations", laborId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labor_allocations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_allocations", laborId] }); toast.success("Removido!"); },
  });

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };
  const openNew = () => { setEditing(null); setForm({ obra_id: "", start_date: "", end_date: "", role: "", daily_rate: "", notes: "" }); setFormOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ obra_id: item.obra_id || "", start_date: item.start_date || "", end_date: item.end_date || "", role: item.role || "", daily_rate: item.daily_rate || "", notes: item.notes || "" });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.start_date) { toast.error("Data início é obrigatória"); return; }
    saveMutation.mutate({
      obra_id: form.obra_id || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      role: form.role || null,
      daily_rate: form.daily_rate ? Number(form.daily_rate) : 0,
      notes: form.notes || null,
    });
  };

  const getObraName = (id: string) => obras.find(o => o.id === id)?.name || "—";
  const formatDate = (d: string) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
  const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Calculate days in each allocation
  const calcDays = (start: string, end: string | null) => {
    if (!start) return "—";
    const s = new Date(start + "T00:00:00");
    const e = end ? new Date(end + "T00:00:00") : new Date();
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? `${diff} dias` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Histórico de Alocação</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma alocação cadastrada.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-700 text-white">
              <th className="text-left px-2 py-2 font-semibold">Obra</th>
              <th className="text-left px-2 py-2 font-semibold">Função</th>
              <th className="text-left px-2 py-2 font-semibold">Início</th>
              <th className="text-left px-2 py-2 font-semibold">Fim</th>
              <th className="text-left px-2 py-2 font-semibold">Duração</th>
              <th className="text-right px-2 py-2 font-semibold">Diária</th>
              <th className="text-center px-2 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-primary/10 ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                <td className="px-2 py-2 font-medium text-foreground">{getObraName(item.obra_id)}</td>
                <td className="px-2 py-2 text-foreground">{item.role || "—"}</td>
                <td className="px-2 py-2 text-foreground">{formatDate(item.start_date)}</td>
                <td className="px-2 py-2 text-foreground">{formatDate(item.end_date)}</td>
                <td className="px-2 py-2 text-foreground">{calcDays(item.start_date, item.end_date)}</td>
                <td className="px-2 py-2 text-right text-foreground">{item.daily_rate ? fmt(Number(item.daily_rate)) : "—"}</td>
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
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar alocação" : "Nova alocação"}</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Obra</label>
              <select value={form.obra_id || ""} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Função</label>
              <input value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Data início *</label>
              <input type="date" value={form.start_date || ""} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Data fim</label>
              <input type="date" value={form.end_date || ""} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Diária (R$)</label>
              <input type="number" step="0.01" value={form.daily_rate || ""} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} className={inputClass} />
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
