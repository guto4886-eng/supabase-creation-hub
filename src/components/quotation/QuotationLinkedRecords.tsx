import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Link2 } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const ENTITY_TYPES = [
  { value: "purchase_request", label: "Solicitação de Compra" },
  { value: "purchase_order", label: "Ordem de Compra" },
];

interface Props {
  quotationId: string | null;
}

export default function QuotationLinkedRecords({ quotationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState("purchase_request");
  const [entityId, setEntityId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["quotation_links", quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await (supabase as any).from("quotation_links")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!quotationId,
  });

  // Fetch purchase requests for selection
  const { data: purchaseRequests = [] } = useQuery({
    queryKey: ["purchase_requests_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_requests").select("id, description, status").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchase orders for selection
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase_orders_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("id, order_code, description, status").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!quotationId || !entityId) throw new Error("Selecione um registro");
      const { error } = await (supabase as any).from("quotation_links").insert({
        quotation_id: quotationId,
        linked_entity_type: entityType,
        linked_entity_id: entityId,
        notes: notes || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_links", quotationId] });
      setEntityId("");
      setNotes("");
      toast.success("Registro vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quotation_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_links", quotationId] });
      toast.success("Vínculo removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getEntityLabel = (type: string, id: string) => {
    if (type === "purchase_request") {
      const pr = purchaseRequests.find((r: any) => r.id === id);
      return pr ? pr.description : id.slice(0, 8);
    }
    if (type === "purchase_order") {
      const po = purchaseOrders.find((r: any) => r.id === id);
      return po ? (po.order_code || po.description || id.slice(0, 8)) : id.slice(0, 8);
    }
    return id.slice(0, 8);
  };

  const selectOptions = entityType === "purchase_request" ? purchaseRequests : purchaseOrders;

  if (!quotationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Salve a cotação primeiro para vincular registros.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Registros Vinculados</h4>

      {/* Add link */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setEntityId(""); }} className={inputClass}>
            {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Registro</label>
          <select value={entityId} onChange={e => setEntityId(e.target.value)} className={inputClass}>
            <option value="">Selecione...</option>
            {selectOptions.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.order_code || r.description || r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => addMutation.mutate()} disabled={!entityId || addMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Vincular
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum registro vinculado.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => (
            <div key={link.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Link2 className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {ENTITY_TYPES.find(t => t.value === link.linked_entity_type)?.label || link.linked_entity_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{getEntityLabel(link.linked_entity_type, link.linked_entity_id)}</p>
                </div>
              </div>
              <button onClick={() => { if (confirm("Remover vínculo?")) removeMutation.mutate(link.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
