import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

const EPI_NAMES = [
  "Capacete", "Luva", "Botina/Bota", "Óculos de proteção", "Protetor auricular",
  "Máscara respiratória", "Cinto de segurança", "Protetor facial", "Avental",
  "Uniforme", "Colete refletivo", "Perneira", "Mangote", "Outro",
];

const STATUS_OPTIONS = [
  { value: "entregue", label: "Entregue" },
  { value: "devolvido", label: "Devolvido" },
  { value: "perdido", label: "Perdido" },
  { value: "danificado", label: "Danificado" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function LaborEpis({ laborId }: { laborId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["labor_epis", laborId],
    queryFn: async () => {
      const { data, error } = await supabase.from("labor_epis" as any).select("*").eq("labor_id", laborId).order("delivery_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        const { error } = await supabase.from("labor_epis" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labor_epis" as any).insert({ ...values, labor_id: laborId, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_epis", laborId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labor_epis" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_epis", laborId] }); toast.success("Removido!"); },
  });

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };
  const openNew = () => { setEditing(null); setForm({ epi_name: "", ca_number: "", delivery_date: "", return_date: "", quantity: "1", status: "entregue", signature: false, notes: "" }); setFormOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ epi_name: item.epi_name, ca_number: item.ca_number || "", delivery_date: item.delivery_date || "", return_date: item.return_date || "", quantity: item.quantity || "1", status: item.status || "entregue", signature: item.signature || false, notes: item.notes || "" });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.epi_name) { toast.error("Nome do EPI é obrigatório"); return; }
    saveMutation.mutate({
      epi_name: form.epi_name,
      ca_number: form.ca_number || null,
      delivery_date: form.delivery_date || null,
      return_date: form.return_date || null,
      quantity: form.quantity ? Number(form.quantity) : 1,
      status: form.status || "entregue",
      signature: form.signature || false,
      notes: form.notes || null,
    });
  };

  const formatDate = (d: string) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
  const statusColor = (s: string) => {
    if (s === "entregue") return "bg-primary/10 text-primary";
    if (s === "devolvido") return "bg-accent text-accent-foreground";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Equipamentos de Proteção Individual</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum EPI cadastrado.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-700 text-white">
              <th className="text-left px-2 py-2 font-semibold">EPI</th>
              <th className="text-left px-2 py-2 font-semibold">C.A.</th>
              <th className="text-center px-2 py-2 font-semibold">Qtd</th>
              <th className="text-left px-2 py-2 font-semibold">Entrega</th>
              <th className="text-left px-2 py-2 font-semibold">Devolução</th>
              <th className="text-center px-2 py-2 font-semibold">Status</th>
              <th className="text-center px-2 py-2 font-semibold">Assinatura</th>
              <th className="text-center px-2 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-primary/10 ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                <td className="px-2 py-2 font-medium text-foreground">{item.epi_name}</td>
                <td className="px-2 py-2 text-foreground">{item.ca_number || "—"}</td>
                <td className="px-2 py-2 text-center text-foreground">{item.quantity}</td>
                <td className="px-2 py-2 text-foreground">{formatDate(item.delivery_date)}</td>
                <td className="px-2 py-2 text-foreground">{formatDate(item.return_date)}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor(item.status)}`}>
                    {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-center text-foreground">{item.signature ? "✓" : "—"}</td>
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
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar EPI" : "Novo EPI"}</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">EPI *</label>
              <select value={form.epi_name || ""} onChange={e => setForm(p => ({ ...p, epi_name: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {EPI_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Nº C.A.</label>
              <input value={form.ca_number || ""} onChange={e => setForm(p => ({ ...p, ca_number: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Quantidade</label>
              <input type="number" min="1" value={form.quantity || "1"} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Data entrega</label>
              <input type="date" value={form.delivery_date || ""} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Data devolução</label>
              <input type="date" value={form.return_date || ""} onChange={e => setForm(p => ({ ...p, return_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Status</label>
              <select value={form.status || "entregue"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer">
              <input type="checkbox" checked={form.signature || false} onChange={e => setForm(p => ({ ...p, signature: e.target.checked }))} className="accent-primary" />
              Assinatura coletada
            </label>
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
