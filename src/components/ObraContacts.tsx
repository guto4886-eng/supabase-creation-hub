import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Props { obraId: string; }

export default function ObraContacts({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const [form, setForm] = useState({ name: "", phone: "", cellphone: "", email: "", notes: "" });

  const { data: contacts = [] } = useQuery({
    queryKey: ["obra_contacts", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_contacts" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Also fetch client contacts linked to this obra's client
  const { data: clientContacts = [] } = useQuery({
    queryKey: ["obra_client_contacts", obraId],
    queryFn: async () => {
      const { data: obra } = await supabase.from("obras").select("client_id").eq("id", obraId).single();
      if (!obra?.client_id) return [];
      const { data, error } = await supabase.from("client_contacts").select("*").eq("client_id", obra.client_id);
      if (error) throw error;
      return (data || []).map((c: any) => ({ ...c, origin: "Cadastro cliente" }));
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const { error } = await supabase.from("obra_contacts" as any).insert({
        obra_id: obraId, user_id: user!.id, name: form.name.trim(),
        phone: form.phone || null, cellphone: form.cellphone || null,
        email: form.email || null, notes: form.notes || null, origin: "manual",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_contacts", obraId] });
      setForm({ name: "", phone: "", cellphone: "", email: "", notes: "" });
      toast.success("Contato adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_contacts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_contacts", obraId] });
      toast.success("Contato removido!");
    },
  });

  const allContacts = [...clientContacts, ...contacts.map((c: any) => ({ ...c, origin: "Manual" }))];

  return (
    <div className="p-5 space-y-5">
      {/* Form */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
            <input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
            <input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Celular</label>
            <input value={form.cellphone} onChange={(e) => setForm(p => ({ ...p, cellphone: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">Observação</label>
              <input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
            </div>
            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <fieldset className="border border-border rounded-lg p-0 overflow-hidden">
        <legend className="ml-3 px-2 text-sm font-medium text-foreground">Contatos</legend>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Origem</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Celular</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">E-mail</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Obs.</th>
              <th className="w-16 px-3 py-2 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allContacts.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum contato</td></tr>
            ) : allContacts.map((c: any) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 text-foreground">{c.origin}</td>
                <td className="px-3 py-2 text-foreground">{c.name}</td>
                <td className="px-3 py-2 text-foreground">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-foreground">{c.cellphone || "—"}</td>
                <td className="px-3 py-2 text-foreground">{c.email || "—"}</td>
                <td className="px-3 py-2 text-foreground">{c.notes || "—"}</td>
                <td className="px-3 py-2">
                  {c.origin === "Manual" && (
                    <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
    </div>
  );
}
