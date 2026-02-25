import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Shield } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "vigente", label: "Vigente" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

const COVERAGE_OPTIONS = [
  { value: "total", label: "Cobertura Total" },
  { value: "terceiros", label: "Contra Terceiros" },
  { value: "incendio_roubo", label: "Incêndio e Roubo" },
  { value: "basica", label: "Básica" },
];

const PAYMENT_OPTIONS = [
  { value: "avista", label: "À Vista" },
  { value: "cartao", label: "Cartão de Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "debito", label: "Débito Automático" },
  { value: "pix", label: "PIX" },
];

const inputCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm";

export default function VehicleInsurance({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: items = [] } = useQuery({
    queryKey: ["vehicle_insurance", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_insurance" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicle_insurance" as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicle_insurance" as any).insert({ ...values, vehicle_id: vehicleId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_insurance", vehicleId] }); toast.success("Salvo!"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_insurance" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_insurance", vehicleId] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const defaultForm = () => ({
    insured_name: "", insurer: "", broker: "", policy_number: "",
    start_date: "", end_date: "", premium_value: "", deductible_value: "",
    coverage_type: "total", payment_method: "boleto", installment_count: "1",
    status: "vigente", notes: "",
  });

  const openNew = () => { setEditing(null); setForm(defaultForm()); setFormOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    const f: Record<string, any> = {};
    Object.keys(defaultForm()).forEach(k => f[k] = item[k] ?? "");
    setForm(f);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    save.mutate(cleaned);
  };

  const statusColor = (s: string) => s === "vigente" ? "text-green-600" : s === "vencido" ? "text-destructive" : "text-muted-foreground";
  const fmt = (v: any) => v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-card-foreground flex items-center gap-2"><Shield className="h-4 w-4" /> Seguros</h4>
        <button onClick={openNew} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo Seguro</button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum seguro cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="border border-border rounded-lg p-4 bg-muted/20">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h5 className="font-medium text-foreground">{item.insurer}</h5>
                  <p className="text-xs text-muted-foreground">Apólice: {item.policy_number || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor(item.status)}`}>
                    {STATUS_OPTIONS.find(s => s.value === item.status)?.label ?? item.status}
                  </span>
                  <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("Remover seguro?")) del.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Segurado:</span><p className="text-foreground">{item.insured_name || "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Corretora:</span><p className="text-foreground">{item.broker || "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Vigência:</span><p className="text-foreground">{item.start_date || "—"} a {item.end_date || "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Prêmio:</span><p className="text-foreground">{fmt(item.premium_value)}</p></div>
                <div><span className="text-muted-foreground text-xs">Franquia:</span><p className="text-foreground">{fmt(item.deductible_value)}</p></div>
                <div><span className="text-muted-foreground text-xs">Cobertura:</span><p className="text-foreground">{COVERAGE_OPTIONS.find(c => c.value === item.coverage_type)?.label ?? item.coverage_type ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Pagamento:</span><p className="text-foreground">{PAYMENT_OPTIONS.find(p => p.value === item.payment_method)?.label ?? item.payment_method ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Parcelas:</span><p className="text-foreground">{item.installment_count ?? 1}x</p></div>
              </div>
              {item.notes && <p className="text-xs text-muted-foreground mt-2 italic">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="font-medium text-card-foreground">{editing ? "Editar" : "Novo"} Seguro</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="border border-border rounded-lg p-3 space-y-3">
              <legend className="px-2 text-xs font-medium text-foreground italic">Dados do Seguro</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Seguradora *</label>
                  <input type="text" required value={form.insurer} onChange={e => setForm(p => ({ ...p, insurer: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Nome do Segurado</label>
                  <input type="text" value={form.insured_name} onChange={e => setForm(p => ({ ...p, insured_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Corretora</label>
                  <input type="text" value={form.broker} onChange={e => setForm(p => ({ ...p, broker: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Nº Apólice</label>
                  <input type="text" value={form.policy_number} onChange={e => setForm(p => ({ ...p, policy_number: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tipo de Cobertura</label>
                  <select value={form.coverage_type} onChange={e => setForm(p => ({ ...p, coverage_type: e.target.value }))} className={inputCls}>
                    {COVERAGE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-lg p-3 space-y-3">
              <legend className="px-2 text-xs font-medium text-foreground italic">Vigência e Valores</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Início Vigência</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fim Vigência</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Prêmio (R$)</label>
                  <input type="number" step="0.01" value={form.premium_value} onChange={e => setForm(p => ({ ...p, premium_value: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Franquia (R$)</label>
                  <input type="number" step="0.01" value={form.deductible_value} onChange={e => setForm(p => ({ ...p, deductible_value: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-lg p-3 space-y-3">
              <legend className="px-2 text-xs font-medium text-foreground italic">Pagamento</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Forma de Pagamento</label>
                  <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className={inputCls}>
                    {PAYMENT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Nº Parcelas</label>
                  <input type="number" min="1" value={form.installment_count} onChange={e => setForm(p => ({ ...p, installment_count: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </fieldset>

            <div>
              <label className="block text-xs font-medium mb-1">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{save.isPending ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
