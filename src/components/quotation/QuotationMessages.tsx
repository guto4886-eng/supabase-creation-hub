import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "negociacao", label: "Negociação" },
  { value: "observacao", label: "Observação" },
  { value: "interna", label: "Interna" },
];

interface Props {
  quotationId: string | null;
}

export default function QuotationMessages({ quotationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("geral");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["quotation_messages", quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await (supabase as any).from("quotation_messages")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!quotationId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!quotationId || !message.trim()) throw new Error("Mensagem obrigatória");
      const { error } = await (supabase as any).from("quotation_messages").insert({
        quotation_id: quotationId,
        message: message.trim(),
        category,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_messages", quotationId] });
      setMessage("");
      toast.success("Mensagem adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quotation_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_messages", quotationId] });
      toast.success("Mensagem removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const catColor: Record<string, string> = {
    geral: "bg-muted text-muted-foreground",
    negociacao: "bg-amber-100 text-amber-700",
    observacao: "bg-blue-100 text-blue-700",
    interna: "bg-purple-100 text-purple-700",
  };

  if (!quotationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Salve a cotação primeiro para adicionar mensagens.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Mensagens</h4>

      {/* Add message */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="w-40">
            <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">Mensagem</label>
            <div className="flex gap-2">
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className={inputClass} placeholder="Digite sua mensagem..." />
              <button onClick={() => addMutation.mutate()} disabled={!message.trim() || addMutation.isPending}
                className="self-end flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages list */}
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma mensagem registrada.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg: any) => (
            <div key={msg.id} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor[msg.category] || catColor.geral}`}>
                        {CATEGORIES.find(c => c.value === msg.category)?.label || msg.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm("Remover mensagem?")) removeMutation.mutate(msg.id); }}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
