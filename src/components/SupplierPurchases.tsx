import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

interface Props {
  supplierId: string;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "parcial", label: "Parcial" },
  { value: "cancelado", label: "Cancelado" },
];

export default function SupplierPurchases({ supplierId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supplier_purchases", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_purchases")
        .select("*, obras(name)")
        .eq("supplier_id", supplierId)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const total = (Number(form.quantity) || 1) * (Number(form.unit_price) || 0);
      const payload = {
        supplier_id: supplierId,
        user_id: user!.id,
        description: form.description,
        obra_id: form.obra_id || null,
        quantity: Number(form.quantity) || 1,
        unit: form.unit || "un",
        unit_price: Number(form.unit_price) || 0,
        total_price: total,
        purchase_date: form.purchase_date || null,
        invoice_number: form.invoice_number || null,
        payment_status: form.payment_status || "pendente",
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("supplier_purchases").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_purchases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_purchases", supplierId] });
      toast.success(editing ? "Compra atualizada!" : "Compra registrada!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_purchases", supplierId] });
      toast.success("Compra removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ quantity: 1, unit: "un", unit_price: 0, payment_status: "pendente", purchase_date: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalGeral = items.reduce((s: number, i: any) => s + (Number(i.total_price) || 0), 0);

  const statusColor = (s: string) => {
    if (s === "pago") return "text-green-600 bg-green-100";
    if (s === "pendente") return "text-amber-600 bg-amber-100";
    if (s === "parcial") return "text-blue-600 bg-blue-100";
    return "text-destructive bg-destructive/10";
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-foreground">Compras</h4>
          {items.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Total: {formatCurrency(totalGeral)}
            </span>
          )}
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          <Plus className="h-3.5 w-3.5" /> Nova compra
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma compra registrada</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Descrição</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Obra</th>
                <th className="text-center px-3 py-2 text-muted-foreground font-medium">Qtd</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor unit.</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Data</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">NF</th>
                <th className="text-center px-3 py-2 text-muted-foreground font-medium">Status</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-foreground">{item.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.obras?.name || "—"}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(Number(item.unit_price) || 0)}</td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">{formatCurrency(Number(item.total_price) || 0)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.purchase_date ? new Date(item.purchase_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.invoice_number || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.payment_status)}`}>
                      {STATUS_OPTIONS.find(s => s.value === item.payment_status)?.label || item.payment_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Remover compra?")) remove.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar" : "Nova"} compra</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Descrição *</label>
              <input value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Obra</label>
              <select value={form.obra_id || ""} onChange={e => setForm(p => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                <option value="">Nenhuma</option>
                {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Data</label>
              <input type="date" value={form.purchase_date || ""} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nº Nota Fiscal</label>
              <input value={form.invoice_number || ""} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Qtd</label>
              <input type="number" step="0.01" value={form.quantity ?? 1} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
              <input value={form.unit || "un"} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Valor unitário</label>
              <input type="number" step="0.01" value={form.unit_price ?? 0} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status pgto.</label>
              <select value={form.payment_status || "pendente"} onChange={e => setForm(p => ({ ...p, payment_status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observações</label>
            <input value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => { if (!form.description?.trim()) { toast.error("Descrição obrigatória"); return; } save.mutate(); }} disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
