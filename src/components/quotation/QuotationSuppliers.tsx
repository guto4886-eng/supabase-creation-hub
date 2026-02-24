import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle } from "lucide-react";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

interface Props {
  quotationId: string | null;
}

export default function QuotationSuppliers({ quotationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_active_qs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: linked = [], isLoading } = useQuery({
    queryKey: ["quotation_suppliers", quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await (supabase as any).from("quotation_suppliers")
        .select("*, suppliers:supplier_id(name, email, phone, cellphone)")
        .eq("quotation_id", quotationId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!quotationId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!quotationId || !supplierId) throw new Error("Selecione um fornecedor");
      const exists = linked.some((l: any) => l.supplier_id === supplierId);
      if (exists) throw new Error("Fornecedor já vinculado");
      const { error } = await (supabase as any).from("quotation_suppliers").insert({
        quotation_id: quotationId,
        supplier_id: supplierId,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_suppliers", quotationId] });
      setSupplierId("");
      toast.success("Fornecedor adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quotation_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_suppliers", quotationId] });
      toast.success("Fornecedor removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelected = useMutation({
    mutationFn: async ({ id, selected }: { id: string; selected: boolean }) => {
      const { error } = await (supabase as any).from("quotation_suppliers").update({ selected }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_suppliers", quotationId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusLabel: Record<string, string> = {
    pendente: "Pendente",
    enviada: "Enviada",
    respondida: "Respondida",
    aprovada: "Aprovada",
  };

  if (!quotationId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Salve a cotação primeiro para vincular fornecedores.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Fornecedores</h4>

      {/* Add supplier */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-1">Adicionar Fornecedor</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
            <option value="">Selecione...</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={() => addMutation.mutate()} disabled={!supplierId || addMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-6"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : linked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhum fornecedor vinculado.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fornecedor</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Situação</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Selecionado</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {linked.map((item: any) => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2 text-foreground font-medium">{item.suppliers?.name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.suppliers?.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.suppliers?.cellphone || item.suppliers?.phone || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{statusLabel[item.status] || item.status}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => toggleSelected.mutate({ id: item.id, selected: !item.selected })}
                      className={`p-1 rounded ${item.selected ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground"}`}>
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { if (confirm("Remover fornecedor?")) removeMutation.mutate(item.id); }}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
