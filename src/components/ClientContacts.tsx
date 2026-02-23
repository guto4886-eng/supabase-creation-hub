import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Users, X } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);

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
    setShowForm(false);
  };

  const startEdit = (c: Contact) => {
    setForm({ name: c.name, phone: c.phone ?? "", cellphone: c.cellphone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Contatos ({contacts.length})
        </h4>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
            <Plus className="h-3.5 w-3.5 inline mr-1" />Adicionar
          </button>
        )}
      </div>

      {showForm && (
        <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">{editingId ? "Editar contato" : "Novo contato"}</span>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Nome *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Nome do contato" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telefone</label>
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="(00) 0000-0000" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Celular</label>
              <input value={form.cellphone} onChange={(e) => setForm((p) => ({ ...p, cellphone: e.target.value }))} className={inputClass} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="email@exemplo.com" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Observação</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Observação" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : contacts.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum contato cadastrado</p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[c.phone, c.cellphone, c.email].filter(Boolean).join(" • ") || "Sem dados de contato"}
                </div>
              </div>
              <button onClick={() => startEdit(c)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { if (confirm("Remover contato?")) deleteMutation.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
