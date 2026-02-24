import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, CheckCircle2 } from "lucide-react";

interface Props {
  quotationId: string | null;
}

export default function QuotationSending({ quotationId }: Props) {
  const qc = useQueryClient();

  const { data: linked = [], isLoading } = useQuery({
    queryKey: ["quotation_suppliers_send", quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await (supabase as any).from("quotation_suppliers")
        .select("*, suppliers:supplier_id(name, email, cellphone)")
        .eq("quotation_id", quotationId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!quotationId,
  });

  const markSent = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const { error } = await (supabase as any).from("quotation_suppliers").update({
        sent_at: new Date().toISOString(),
        sent_method: method,
        status: "enviada",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_suppliers_send", quotationId] });
      qc.invalidateQueries({ queryKey: ["quotation_suppliers", quotationId] });
      toast.success("Marcado como enviado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!quotationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Salve a cotação primeiro para gerenciar envios.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Envio da Cotação</h4>
      <p className="text-sm text-muted-foreground">Controle o envio da cotação para cada fornecedor vinculado.</p>

      {isLoading ? (
        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : linked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum fornecedor vinculado. Adicione fornecedores na aba "Fornecedores".</p>
      ) : (
        <div className="space-y-3">
          {linked.map((item: any) => (
            <div key={item.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-foreground">{item.suppliers?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {item.suppliers?.email || "Sem email"} • {item.suppliers?.cellphone || "Sem telefone"}
                </p>
              </div>
              <div className="text-right">
                {item.sent_at ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <div>
                      <p className="text-xs font-medium">Enviado via {item.sent_method || "—"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => markSent.mutate({ id: item.id, method: "email" })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                      <Send className="h-3 w-3" /> Email
                    </button>
                    <button onClick={() => markSent.mutate({ id: item.id, method: "whatsapp" })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:opacity-90">
                      <Send className="h-3 w-3" /> WhatsApp
                    </button>
                    <button onClick={() => markSent.mutate({ id: item.id, method: "manual" })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs font-medium hover:bg-muted/80 border border-border">
                      Manual
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
