import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const DOC_TYPES = [
  { value: "licenciamento", label: "Licenciamento" },
  { value: "ipva", label: "IPVA" },
  { value: "seguro", label: "Seguro" },
  { value: "multa", label: "Multa" },
  { value: "dpvat", label: "DPVAT" },
  { value: "taxa", label: "Taxa" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
];

export default function VehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: docs = [] } = useQuery({
    queryKey: ["vehicle_documents", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_documents" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicle_documents" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_documents" as any).insert({ ...values, vehicle_id: vehicleId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_documents", vehicleId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_documents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_documents", vehicleId] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ doc_type: "licenciamento", description: "", reference_year: new Date().getFullYear(), due_date: "", payment_date: "", value: "", status: "pendente", insurer: "", policy_number: "", notes: "" });
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ doc_type: item.doc_type, description: item.description, reference_year: item.reference_year ?? "", due_date: item.due_date ?? "", payment_date: item.payment_date ?? "", value: item.value ?? "", status: item.status, insurer: item.insurer ?? "", policy_number: item.policy_number ?? "", notes: item.notes ?? "" });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    save.mutate(cleaned);
  };

  const statusColor = (s: string) => s === "pago" ? "text-green-600" : s === "vencido" ? "text-destructive" : "text-amber-600";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-card-foreground">Documentos e Taxas</h4>
        <button onClick={openNew} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo</button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Descrição</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ano Ref.</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Vencimento</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              <th className="w-20 px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-border">
              {docs.map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{DOC_TYPES.find(t => t.value === d.doc_type)?.label ?? d.doc_type}</td>
                  <td className="px-3 py-2">{d.description}</td>
                  <td className="px-3 py-2">{d.reference_year ?? "—"}</td>
                  <td className="px-3 py-2">{d.due_date ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{d.value ? Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                  <td className={`px-3 py-2 font-medium ${statusColor(d.status)}`}>{STATUS_OPTIONS.find(s => s.value === d.status)?.label ?? d.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Remover?")) del.mutate(d.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
            <h5 className="font-medium text-card-foreground">{editing ? "Editar" : "Novo"} Documento</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input type="text" required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ano Referência</label>
              <input type="number" value={form.reference_year} onChange={e => setForm(p => ({ ...p, reference_year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimento</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Pagamento</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Seguradora</label>
              <input type="text" value={form.insurer} onChange={e => setForm(p => ({ ...p, insurer: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nº Apólice</label>
              <input type="text" value={form.policy_number} onChange={e => setForm(p => ({ ...p, policy_number: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
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
