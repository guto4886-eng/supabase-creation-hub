import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Search, Trash2, MessageSquareWarning, RefreshCw } from "lucide-react";

interface Props { obraId: string; }

export default function ObraServiceMessages({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterCat, setFilterCat] = useState("");

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["obra_service_messages", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_messages")
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = filterCat ? entries.filter((e: any) => e.category === filterCat) : entries;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Mensagem é obrigatória");
      // Get client_id from obra
      const { data: obra } = await supabase.from("obras").select("client_id").eq("id", obraId).single();
      if (!obra?.client_id) throw new Error("Obra sem cliente vinculado");
      const { error } = await supabase.from("client_messages").insert({
        obra_id: obraId, client_id: obra.client_id, user_id: user!.id,
        message: message.trim(), category: category || "geral",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_service_messages", obraId] });
      setMessage("");
      setCategory("");
      toast.success("Mensagem adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_service_messages", obraId] });
      toast.success("Removido!");
    },
  });

  return (
    <div className="p-5 flex flex-col h-full">
      <div className="flex justify-end mb-3">
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="text-primary text-sm hover:underline">
          Filtros {filtersOpen ? "▴" : "▾"}
        </button>
      </div>

      {filtersOpen && (
        <div className="flex items-end gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Categoria</label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm">
              <option value="">Todas</option>
              <option value="geral">Geral</option>
              <option value="financeiro">Financeiro</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>
          <button onClick={() => refetch()} className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            <Search className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
            <MessageSquareWarning className="h-12 w-12 text-amber-400" />
            <p className="text-sm font-medium text-amber-600">NENHUMA MENSAGEM ENCONTRADA.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e: any) => (
              <div key={e.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-foreground">{e.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {e.category} · {new Date(e.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(e.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 justify-end">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
          <option value="">Categoria</option>
          <option value="geral">Geral</option>
          <option value="financeiro">Financeiro</option>
          <option value="tecnico">Técnico</option>
        </select>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite uma mensagem..." rows={2} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !message.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </div>
  );
}
