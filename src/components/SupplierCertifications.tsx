import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

interface Props {
  supplierId: string;
}

const STATUS_OPTIONS = [
  { value: "vigente", label: "Vigente" },
  { value: "vencida", label: "Vencida" },
  { value: "em_renovacao", label: "Em renovação" },
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function SupplierCertifications({ supplierId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supplier_certifications", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_certifications").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier_id: supplierId,
        user_id: user!.id,
        name: form.name,
        issuer: form.issuer || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        certificate_number: form.certificate_number || null,
        status: form.status || "vigente",
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("supplier_certifications").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_certifications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_certifications", supplierId] });
      toast.success(editing ? "Atualizado!" : "Certificação adicionada!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_certifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_certifications", supplierId] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ status: "vigente" }); setFormOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  const statusColor: Record<string, string> = {
    vigente: "bg-green-500/10 text-green-600",
    vencida: "bg-destructive/10 text-destructive",
    em_renovacao: "bg-amber-500/10 text-amber-600",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Certificações</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma certificação cadastrada</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30"><th className="text-left px-3 py-2 text-muted-foreground font-medium">Certificação</th><th className="text-left px-3 py-2 text-muted-foreground font-medium">Emissor</th><th className="text-left px-3 py-2 text-muted-foreground font-medium">Validade</th><th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th><th className="w-20 px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-border">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground">{item.name}{item.certificate_number && <span className="text-xs text-muted-foreground ml-1">({item.certificate_number})</span>}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.issuer || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.expiry_date ? new Date(item.expiry_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[item.status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                  </span>
                </td>
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
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar" : "Nova"} certificação</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">Nome *</label><input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Emissor</label><input value={form.issuer || ""} onChange={e => setForm(p => ({ ...p, issuer: e.target.value }))} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">Nº Certificado</label><input value={form.certificate_number || ""} onChange={e => setForm(p => ({ ...p, certificate_number: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Data emissão</label><input type="date" value={form.issue_date || ""} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Validade</label><input type="date" value={form.expiry_date || ""} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={form.status || "vigente"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">Observações</label><input value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => { if (!form.name?.trim()) { toast.error("Nome obrigatório"); return; } save.mutate(); }} disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
