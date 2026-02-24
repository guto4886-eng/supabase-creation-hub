import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "salario", label: "Conta Salário" },
];

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

interface Props {
  supplierId: string;
}

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function SupplierBankAccounts({ supplierId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supplier_bank_accounts", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_bank_accounts")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        supplier_id: supplierId,
        user_id: user!.id,
        bank_name: form.bank_name || null,
        agency: form.agency || null,
        account: form.account || null,
        account_type: form.account_type || "corrente",
        pix_key: form.pix_key || null,
        pix_type: form.pix_type || null,
        holder_name: form.holder_name || null,
        holder_document: form.holder_document || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("supplier_bank_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_bank_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_bank_accounts", supplierId] });
      toast.success(editing ? "Atualizado!" : "Conta adicionada!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_bank_accounts", supplierId] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ account_type: "corrente" }); setFormOpen(true); };
  const openEdit = (item: any) => { setEditing(item); setForm({ ...item }); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({}); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Dados Bancários</h4>
        <button onClick={openNew} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          <Plus className="h-3.5 w-3.5" /> Adicionar conta
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta bancária cadastrada</p>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="border border-border rounded-lg p-4 space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.bank_name || "Banco não informado"}</p>
                  <p className="text-xs text-muted-foreground">
                    Ag: {item.agency || "—"} | Conta: {item.account || "—"} | {ACCOUNT_TYPES.find(t => t.value === item.account_type)?.label || item.account_type}
                  </p>
                  {item.pix_key && <p className="text-xs text-muted-foreground">PIX: {item.pix_key} ({PIX_TYPES.find(t => t.value === item.pix_type)?.label || item.pix_type})</p>}
                  {item.holder_name && <p className="text-xs text-muted-foreground">Titular: {item.holder_name}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("Remover conta?")) remove.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="text-sm font-medium text-foreground">{editing ? "Editar" : "Nova"} conta</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">Banco</label><input value={form.bank_name || ""} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Agência</label><input value={form.agency || ""} onChange={e => setForm(p => ({ ...p, agency: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Conta</label><input value={form.account || ""} onChange={e => setForm(p => ({ ...p, account: e.target.value }))} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipo de conta</label>
              <select value={form.account_type || "corrente"} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))} className={inputClass}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">Chave PIX</label><input value={form.pix_key || ""} onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))} className={inputClass} /></div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipo PIX</label>
              <select value={form.pix_type || ""} onChange={e => setForm(p => ({ ...p, pix_type: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {PIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-muted-foreground mb-1">Titular</label><input value={form.holder_name || ""} onChange={e => setForm(p => ({ ...p, holder_name: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">CPF/CNPJ do titular</label><input value={form.holder_document || ""} onChange={e => setForm(p => ({ ...p, holder_document: e.target.value }))} className={inputClass} /></div>
          </div>
          <div><label className="block text-xs text-muted-foreground mb-1">Observações</label><input value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} /></div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
            <button onClick={() => save.mutate()} disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
