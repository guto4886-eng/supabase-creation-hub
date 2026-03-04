import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Eye, EyeOff, Pencil } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface Props {
  companyId: string;
}

const EMPTY = { title: "", url: "", username: "", password: "", description: "" };

export default function CompanyLinks({ companyId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["company_links", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_links")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.url) throw new Error("Título e URL são obrigatórios");
      if (editingId) {
        const { error } = await (supabase as any)
          .from("company_links")
          .update({ title: form.title, url: form.url, username: form.username || null, password: form.password || null, description: form.description || null })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("company_links")
          .insert({ company_id: companyId, user_id: user!.id, title: form.title, url: form.url, username: form.username || null, password: form.password || null, description: form.description || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_links", companyId] });
      setForm(EMPTY);
      setEditingId(null);
      toast.success(editingId ? "Link atualizado!" : "Link adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("company_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_links", companyId] });
      toast.success("Link removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (link: any) => {
    setEditingId(link.id);
    setForm({ title: link.title, url: link.url, username: link.username || "", password: link.password || "", description: link.description || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const togglePassword = (id: string) => {
    setShowPasswords((p) => ({ ...p, [id]: !p[id] }));
  };

  const ensureUrl = (url: string) => {
    if (!/^https?:\/\//i.test(url)) return `https://${url}`;
    return url;
  };

  return (
    <div className="p-5 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Links Úteis</h4>

      {/* Form */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Portal do Fornecedor" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">URL *</label>
            <input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://portal.exemplo.com" className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Usuário</label>
            <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="usuario@email.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="••••••" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
          <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição do link" className={inputClass} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.url || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {editingId ? "Atualizar" : "Adicionar"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum link cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => (
            <div key={link.id} className="border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{link.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <a href={ensureUrl(link.url)} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-primary/10 text-primary" title="Abrir site">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => startEdit(link)} className="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("Remover este link?")) deleteMutation.mutate(link.id); }}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {link.description && <p className="text-xs text-muted-foreground ml-6">{link.description}</p>}
              {(link.username || link.password) && (
                <div className="flex items-center gap-4 ml-6 text-xs text-muted-foreground">
                  {link.username && <span>Usuário: <span className="text-foreground font-medium">{link.username}</span></span>}
                  {link.password && (
                    <span className="flex items-center gap-1">
                      Senha: <span className="text-foreground font-medium">{showPasswords[link.id] ? link.password : "••••••"}</span>
                      <button onClick={() => togglePassword(link.id)} className="p-0.5 hover:text-foreground">
                        {showPasswords[link.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
