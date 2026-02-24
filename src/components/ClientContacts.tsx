import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Mail } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  cellphone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  clientId: string;
}

const emptyForm = { name: "", phone: "", cellphone: "", email: "", notes: "" };

export default function ClientContacts({ clientId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const queryKey = ["client_contacts", clientId];

  const { data: contacts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Contact[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (editingId) {
        const { error } = await supabase
          .from("client_contacts" as any)
          .update({ name: form.name, phone: form.phone || null, cellphone: form.cellphone || null, email: form.email || null, notes: form.notes || null } as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_contacts" as any)
          .insert({ client_id: clientId, user_id: user!.id, name: form.name, phone: form.phone || null, cellphone: form.cellphone || null, email: form.email || null, notes: form.notes || null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success(editingId ? "Contato atualizado!" : "Contato adicionado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_contacts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Contato removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (c: Contact) => {
    setForm({ name: c.name, phone: c.phone ?? "", cellphone: c.cellphone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setEditingId(c.id);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="space-y-6">
      {/* Form area - always visible */}
      <div className="space-y-4">
        {/* Row 1: Nome + Telefone */}
        <div className="grid grid-cols-2 gap-x-8">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[90px] text-right">Nome *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[70px] text-right">Telefone</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="(00) 0000-0000" />
          </div>
        </div>

        {/* Row 2: E-mail + Celular */}
        <div className="grid grid-cols-2 gap-x-8">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[90px] text-right">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[70px] text-right">Celular</label>
            <input value={form.cellphone} onChange={(e) => setForm((p) => ({ ...p, cellphone: e.target.value }))} className={inputClass} placeholder="(00) 00000-0000" />
          </div>
        </div>

        {/* Row 3: Observação + Adicionar button */}
        <div className="grid grid-cols-2 gap-x-8">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-card-foreground whitespace-nowrap min-w-[90px] text-right">Observação</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} />
          </div>
          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <button type="button" onClick={resetForm} className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4 inline mr-1" />Cancelar
              </button>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>

      {/* Contacts table */}
      <fieldset className="border border-border rounded-lg p-0 overflow-hidden">
        <legend className="text-sm font-semibold text-muted-foreground px-2 ml-3">Contatos</legend>
        {isLoading ? (
          <div className="flex justify-center py-6"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Celular</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">E-mail</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Obs.</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Nenhum contato cadastrado</td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-foreground">{c.name}</td>
                    <td className="px-3 py-2 text-foreground">{c.phone || "—"}</td>
                    <td className="px-3 py-2 text-foreground">{c.cellphone || "—"}</td>
                    <td className="px-3 py-2 text-foreground">{c.email || "—"}</td>
                    <td className="px-3 py-2 text-foreground truncate max-w-[120px]" title={c.notes ?? ""}>{c.notes || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(c)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("Remover contato?")) deleteMutation.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Enviar e-mail">
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </fieldset>
    </div>
  );
}
