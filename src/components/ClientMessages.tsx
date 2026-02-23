import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, X, Filter } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  category: string;
  message: string;
  obra_id: string | null;
  created_at: string;
}

interface Obra {
  id: string;
  name: string;
}

interface Props {
  clientId: string;
}

const categories = [
  { value: "geral", label: "Geral" },
  { value: "reuniao", label: "Reunião" },
  { value: "visita", label: "Visita" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

export default function ClientMessages({ clientId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "geral", message: "", obra_id: "" });
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const queryKey = ["client_messages", clientId];

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_messages" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Message[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as Obra[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.message.trim()) throw new Error("Mensagem é obrigatória");
      const { error } = await supabase
        .from("client_messages" as any)
        .insert({
          client_id: clientId,
          user_id: user!.id,
          category: form.category,
          message: form.message,
          obra_id: form.obra_id || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Mensagem adicionada!");
      setForm({ category: "geral", message: "", obra_id: "" });
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_messages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Mensagem removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = messages.filter((m) => {
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterDateFrom && m.created_at < filterDateFrom) return false;
    if (filterDateTo && m.created_at > filterDateTo + "T23:59:59") return false;
    return true;
  });

  const getCategoryLabel = (val: string) => categories.find((c) => c.value === val)?.label ?? val;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Atendimento ({messages.length})
        </h4>
        <div className="flex gap-1.5">
          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFilters ? "bg-accent border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <Filter className="h-3.5 w-3.5 inline mr-1" />Filtros
          </button>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
              <Plus className="h-3.5 w-3.5 inline mr-1" />Nova
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={inputClass}>
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button onClick={() => { setFilterCategory(""); setFilterDateFrom(""); setFilterDateTo(""); }} className="text-xs text-primary hover:underline">Limpar filtros</button>
        </div>
      )}

      {showForm && (
        <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Nova mensagem</span>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Categoria *</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Obra</label>
              <select value={form.obra_id} onChange={(e) => setForm((p) => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                <option value="">Nenhuma</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mensagem *</label>
            <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} rows={3} className={inputClass} placeholder="Digite sua mensagem..." />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {saveMutation.isPending ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma mensagem</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.map((m) => (
            <div key={m.id} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{getCategoryLabel(m.category)}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap text-xs">{m.message}</p>
                </div>
                <button onClick={() => { if (confirm("Remover mensagem?")) deleteMutation.mutate(m.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
