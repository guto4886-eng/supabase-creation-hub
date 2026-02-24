import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, MessageSquareWarning } from "lucide-react";

interface Props { obraId: string; }

export default function ObraDailyEntries({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["obra_daily_entries", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_daily_entries" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Mensagem é obrigatória");
      const { error } = await supabase.from("obra_daily_entries" as any).insert({
        obra_id: obraId, user_id: user!.id, message: message.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_daily_entries", obraId] });
      setMessage("");
      toast.success("Entrada adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_daily_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_daily_entries", obraId] });
      toast.success("Removido!");
    },
  });

  return (
    <div className="p-5 flex flex-col h-full">
      <fieldset className="border border-border rounded-lg p-4 flex-1 flex flex-col">
        <legend className="px-2 text-sm font-medium text-foreground flex items-center justify-between w-full">
          <span>Mensagens</span>
          <button onClick={() => refetch()} className="text-primary text-xs hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </legend>

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
              <MessageSquareWarning className="h-12 w-12 text-amber-400" />
              <p className="text-sm font-medium text-amber-600">NENHUMA MENSAGEM ENCONTRADA.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{e.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
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
      </fieldset>

      <div className="flex items-center gap-2 mt-4 justify-end">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite uma mensagem..." rows={2} className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !message.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </div>
  );
}
