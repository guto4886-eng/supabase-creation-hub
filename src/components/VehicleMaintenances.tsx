import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const MAINT_TYPES = [
  { value: "preventiva", label: "Preventiva" },
  { value: "corretiva", label: "Corretiva" },
  { value: "revisao", label: "Revisão" },
  { value: "troca_oleo", label: "Troca de Óleo" },
  { value: "pneus", label: "Pneus" },
  { value: "funilaria", label: "Funilaria/Pintura" },
  { value: "eletrica", label: "Elétrica" },
  { value: "outro", label: "Outro" },
];

export default function VehicleMaintenances({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["vehicle_maintenances", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_maintenances" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicle_maintenances" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_maintenances" as any).insert({ ...values, vehicle_id: vehicleId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_maintenances", vehicleId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_maintenances" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_maintenances", vehicleId] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ maintenance_type: "preventiva", description: "", maintenance_date: new Date().toISOString().slice(0, 10), km_at_maintenance: "", next_km: "", next_date: "", value: "", notes: "" });
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ maintenance_type: item.maintenance_type, description: item.description, maintenance_date: item.maintenance_date ?? "", km_at_maintenance: item.km_at_maintenance ?? "", next_km: item.next_km ?? "", next_date: item.next_date ?? "", value: item.value ?? "", notes: item.notes ?? "" });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    save.mutate(cleaned);
  };

  const fmt = (v: any) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-card-foreground">Manutenções</h4>
        <button onClick={openNew} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Nova</button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descrição</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">KM</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
              <th className="w-20 px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((m: any) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{MAINT_TYPES.find(t => t.value === m.maintenance_type)?.label ?? m.maintenance_type}</td>
                  <td className="px-3 py-2">{m.description}</td>
                  <td className="px-3 py-2">{m.maintenance_date ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{m.km_at_maintenance ? Number(m.km_at_maintenance).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmt(m.value)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Remover?")) del.mutate(m.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="font-medium text-card-foreground">{editing ? "Editar" : "Nova"} Manutenção</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.maintenance_type} onChange={e => setForm(p => ({ ...p, maintenance_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
                {MAINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input type="text" required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input type="date" value={form.maintenance_date} onChange={e => setForm(p => ({ ...p, maintenance_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">KM no momento</label>
              <input type="number" value={form.km_at_maintenance} onChange={e => setForm(p => ({ ...p, km_at_maintenance: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Próxima KM</label>
              <input type="number" value={form.next_km} onChange={e => setForm(p => ({ ...p, next_km: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Próxima Data</label>
              <input type="date" value={form.next_date} onChange={e => setForm(p => ({ ...p, next_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{save.isPending ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
