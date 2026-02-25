import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check, Upload, Download, FileText } from "lucide-react";

const DOC_TYPES = [
  { value: "licenciamento", label: "Licenciamento" },
  { value: "ipva", label: "IPVA" },
  { value: "multa", label: "Multa" },
  { value: "dpvat", label: "DPVAT" },
  { value: "taxa", label: "Taxa" },
  { value: "documento_veiculo", label: "Documento do Veículo (CRLV)" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
];

const PAYMENT_MODE_OPTIONS = [
  { value: "unica", label: "Cota Única" },
  { value: "parcelado", label: "Parcelado" },
];

const inputCls = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm";

export default function VehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["vehicle_documents", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_documents" as any)
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from("vehicle_documents" as any).update(values).eq("id", editing.id);
        if (error) throw error;
        // If IPVA parcelado, generate installments
        if (values.doc_type === "ipva" && values.payment_mode === "parcelado" && values.installment_count > 1) {
          await generateInstallments(editing.id, values);
        }
      } else {
        const { data, error } = await supabase.from("vehicle_documents" as any).insert({ ...values, vehicle_id: vehicleId, user_id: user!.id }).select("id").single();
        if (error) throw error;
        if (values.doc_type === "ipva" && values.payment_mode === "parcelado" && values.installment_count > 1 && data) {
          await generateInstallments((data as any).id, values);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle_documents", vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicle_doc_installments"] });
      toast.success("Salvo!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateInstallments = async (docId: string, values: Record<string, any>) => {
    // Delete existing installments first
    await supabase.from("vehicle_doc_installments" as any).delete().eq("document_id", docId);
    
    const count = Number(values.installment_count) || 1;
    const totalValue = Number(values.value) || 0;
    const installmentValue = totalValue / count;
    const baseDate = values.due_date ? new Date(values.due_date) : new Date();

    const installments = Array.from({ length: count }, (_, i) => {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        document_id: docId,
        installment_number: i + 1,
        due_date: dueDate.toISOString().split("T")[0],
        value: Math.round(installmentValue * 100) / 100,
        status: "pendente",
        user_id: user!.id,
      };
    });

    const { error } = await supabase.from("vehicle_doc_installments" as any).insert(installments as any);
    if (error) console.error("Error creating installments:", error);
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_documents" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_documents", vehicleId] }); toast.success("Removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ doc_type: "licenciamento", description: "", reference_year: new Date().getFullYear(), due_date: "", payment_date: "", value: "", status: "pendente", insurer: "", policy_number: "", notes: "", payment_mode: "unica", installment_count: "1" });
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      doc_type: item.doc_type, description: item.description, reference_year: item.reference_year ?? "",
      due_date: item.due_date ?? "", payment_date: item.payment_date ?? "", value: item.value ?? "",
      status: item.status, insurer: item.insurer ?? "", policy_number: item.policy_number ?? "",
      notes: item.notes ?? "", payment_mode: item.payment_mode ?? "unica",
      installment_count: item.installment_count ?? "1",
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(form)) cleaned[k] = v === "" ? null : v;
    save.mutate(cleaned);
  };

  const statusColor = (s: string) => s === "pago" ? "text-green-600" : s === "vencido" ? "text-destructive" : "text-amber-600";
  const isIpva = form.doc_type === "ipva";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-card-foreground">Documentos e Taxas</h4>
        <button onClick={openNew} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Novo</button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <div key={d.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 hover:bg-muted/40 cursor-pointer" onClick={() => setExpandedDoc(expandedDoc === d.id ? null : d.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{DOC_TYPES.find(t => t.value === d.doc_type)?.label ?? d.doc_type}</span>
                  <span className="text-xs text-muted-foreground">{d.description}</span>
                  {d.reference_year && <span className="text-xs text-muted-foreground">({d.reference_year})</span>}
                </div>
                <div className="flex items-center gap-3">
                  {d.value && <span className="text-sm text-foreground">{Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                  <span className={`text-xs font-medium ${statusColor(d.status)}`}>{STATUS_OPTIONS.find(s => s.value === d.status)?.label ?? d.status}</span>
                  {d.doc_type === "ipva" && d.payment_mode === "parcelado" && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{d.installment_count}x</span>}
                  <button onClick={(e) => { e.stopPropagation(); openEdit(d); }} className="p-1 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Remover?")) del.mutate(d.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {expandedDoc === d.id && (
                <div className="px-3 py-3 border-t border-border bg-background">
                  {d.doc_type === "ipva" && d.payment_mode === "parcelado" ? (
                    <InstallmentsList documentId={d.id} />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Vencimento:</span> <span className="text-foreground">{d.due_date ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Pagamento:</span> <span className="text-foreground">{d.payment_date ?? "—"}</span></div>
                      {d.insurer && <div><span className="text-muted-foreground">Seguradora:</span> <span className="text-foreground">{d.insurer}</span></div>}
                      {d.policy_number && <div><span className="text-muted-foreground">Apólice:</span> <span className="text-foreground">{d.policy_number}</span></div>}
                      {d.notes && <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> <span className="text-foreground">{d.notes}</span></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex justify-between items-center">
            <h5 className="font-medium text-card-foreground">{editing ? "Editar" : "Novo"} Documento</h5>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))} className={inputCls}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input type="text" required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ano Referência</label>
              <input type="number" value={form.reference_year} onChange={e => setForm(p => ({ ...p, reference_year: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimento</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inputCls} />
            </div>

            {isIpva && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
                  <select value={form.payment_mode} onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value, installment_count: e.target.value === "unica" ? "1" : p.installment_count }))} className={inputCls}>
                    {PAYMENT_MODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {form.payment_mode === "parcelado" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Nº de Parcelas</label>
                    <input type="number" min="2" max="12" value={form.installment_count} onChange={e => setForm(p => ({ ...p, installment_count: e.target.value }))} className={inputCls} />
                  </div>
                )}
              </>
            )}

            {!isIpva && (
              <div>
                <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} className={inputCls} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputCls} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={save.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{save.isPending ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Sub-component for installment tracking
function InstallmentsList({ documentId }: { documentId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ["vehicle_doc_installments", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_doc_installments" as any)
        .select("*")
        .eq("document_id", documentId)
        .order("installment_number", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateInstallment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("vehicle_doc_installments" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicle_doc_installments", documentId] });
      toast.success("Parcela atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markAsPaid = (inst: any) => {
    updateInstallment.mutate({
      id: inst.id,
      updates: { status: "pago", payment_date: new Date().toISOString().split("T")[0] },
    });
  };

  const uploadProof = useCallback(async (installmentId: string, file: File) => {
    if (!user) return;
    setUploadingId(installmentId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/ipva_proofs/${installmentId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("vehicle_doc_installments" as any)
        .update({ proof_path: path, proof_file_name: file.name } as any)
        .eq("id", installmentId);
      if (dbError) throw dbError;

      qc.invalidateQueries({ queryKey: ["vehicle_doc_installments", documentId] });
      toast.success("Comprovante enviado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  }, [user, documentId, qc]);

  const downloadProof = async (inst: any) => {
    const { data, error } = await supabase.storage.from("attachments").download(inst.proof_path);
    if (error) { toast.error("Erro ao baixar"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = inst.proof_file_name || "comprovante";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="text-xs text-muted-foreground">Carregando parcelas...</div>;
  if (installments.length === 0) return <div className="text-xs text-muted-foreground">Nenhuma parcela gerada. Edite o documento para gerar.</div>;

  return (
    <div className="space-y-2">
      <h6 className="text-xs font-semibold text-muted-foreground uppercase">Parcelas do IPVA</h6>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Parcela</th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Vencimento</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Valor</th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Pago em</th>
              <th className="text-center px-2 py-1.5 font-medium text-muted-foreground">Comprovante</th>
              <th className="text-center px-2 py-1.5 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((inst: any) => (
              <tr key={inst.id} className="hover:bg-muted/20">
                <td className="px-2 py-1.5">{inst.installment_number}ª</td>
                <td className="px-2 py-1.5">{inst.due_date ?? "—"}</td>
                <td className="px-2 py-1.5 text-right">{inst.value ? Number(inst.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                <td className={`px-2 py-1.5 font-medium ${inst.status === "pago" ? "text-green-600" : inst.status === "vencido" ? "text-destructive" : "text-amber-600"}`}>
                  {inst.status === "pago" ? "Pago" : inst.status === "vencido" ? "Vencido" : "Pendente"}
                </td>
                <td className="px-2 py-1.5">{inst.payment_date ?? "—"}</td>
                <td className="px-2 py-1.5 text-center">
                  {inst.proof_path ? (
                    <button onClick={() => downloadProof(inst)} className="inline-flex items-center gap-1 text-primary hover:underline" title="Baixar comprovante">
                      <FileText className="h-3 w-3" /> {inst.proof_file_name || "Ver"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    {inst.status !== "pago" && (
                      <button onClick={() => markAsPaid(inst)} title="Marcar como pago" className="p-1 rounded hover:bg-green-100 text-green-600">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.onchange = (e: any) => {
                          if (e.target.files?.[0]) uploadProof(inst.id, e.target.files[0]);
                        };
                        input.click();
                      }}
                      title="Enviar comprovante"
                      disabled={uploadingId === inst.id}
                      className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
