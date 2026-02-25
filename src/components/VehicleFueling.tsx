import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const FUEL_TYPES = [
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "gnv", label: "GNV" },
  { value: "eletrico", label: "Elétrico" },
];

export default function VehicleFueling({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["vehicle_fueling", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_fueling" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("fueling_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicle_fueling" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_fueling" as any).insert({ ...values, vehicle_id: vehicleId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_fueling", vehicleId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_fueling" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_fueling", vehicleId] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ fueling_date: new Date().toISOString().slice(0, 10), fuel_type: "gasolina", liters: "", price_per_liter: "", total_value: "", km_at_fueling: "", station: "", notes: "" });
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ fueling_date: item.fueling_date ?? "", fuel_type: item.fuel_type, liters: item.liters ?? "", price_per_liter: item.price_per_liter ?? "", total_value: item.total_value ?? "", km_at_fueling: item.km_at_fueling ?? "", station: item.station ?? "", notes: item.notes ?? "" });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    // Auto-calc total
    if (cleaned.liters && cleaned.price_per_liter && !cleaned.total_value) {
      cleaned.total_value = Number(cleaned.liters) * Number(cleaned.price_per_liter);
    }
    save.mutate(cleaned);
  };

  const fmt = (v: any) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-card-foreground">Abastecimentos</h4>
        <button onClick={openNew} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo</button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum abastecimento registrado.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Combustível</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Litros</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">R$/L</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">KM</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Posto</th>
              <th className="w-20 px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((f: any) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{f.fueling_date ?? "—"}</td>
                  <td className="px-3 py-2">{FUEL_TYPES.find(t => t.value === f.fuel_type)?.label ?? f.fuel_type}</td>
                  <td className="px-3 py-2 text-right">{f.liters ? Number(f.liters).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-right">{f.price_per_liter ? Number(f.price_per_liter).toLocaleString("pt-BR", { minimumFractionDigits: 3 }) : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmt(f.total_value)}</td>
                  <td className="px-3 py-2 text-right">{f.km_at_fueling ? Number(f.km_at_fueling).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2">{f.station ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Remover?")) del.mutate(f.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
            <h5 className="font-medium text-card-foreground">{editing ? "Editar" : "Novo"} Abastecimento</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input type="date" value={form.fueling_date} onChange={e => setForm(p => ({ ...p, fueling_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Combustível</label>
              <select value={form.fuel_type} onChange={e => setForm(p => ({ ...p, fuel_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
                {FUEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Litros</label>
              <input type="number" step="0.01" value={form.liters} onChange={e => setForm(p => ({ ...p, liters: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preço/Litro</label>
              <input type="number" step="0.001" value={form.price_per_liter} onChange={e => setForm(p => ({ ...p, price_per_liter: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total (R$)</label>
              <input type="number" step="0.01" value={form.total_value} onChange={e => setForm(p => ({ ...p, total_value: e.target.value }))} placeholder="Auto-calculado" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">KM Atual</label>
              <input type="number" value={form.km_at_fueling} onChange={e => setForm(p => ({ ...p, km_at_fueling: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Posto</label>
              <input type="text" value={form.station} onChange={e => setForm(p => ({ ...p, station: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
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
