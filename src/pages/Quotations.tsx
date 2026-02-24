import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, X, Download, Search, CheckCircle } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";

interface Quotation {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  description: string | null;
  obra_id: string | null;
  created_at: string;
}

interface QuotationResponse {
  id: string;
  quotation_id: string;
  supplier_id: string;
  value: number;
  notes: string | null;
  selected: boolean;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

const statusOptions = [
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em análise" },
  { value: "fechada", label: "Fechada" },
];

export default function Quotations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Quotation form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState({ title: "", status: "aberta", deadline: "", description: "", obra_id: "" });

  // Response form
  const [responseFormFor, setResponseFormFor] = useState<string | null>(null);
  const [responseForm, setResponseForm] = useState({ supplier_id: "", value: "0", notes: "" });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Quotation[];
    },
  });

  const { data: allResponses = [] } = useQuery({
    queryKey: ["quotation_responses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotation_responses").select("*").order("value", { ascending: true });
      if (error) throw error;
      return data as QuotationResponse[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const saveQuotation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        status: form.status,
        deadline: form.deadline || null,
        description: form.description || null,
        obra_id: form.obra_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quotations").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success(editing ? "Cotação atualizada!" : "Cotação criada!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Cotação removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveResponse = useMutation({
    mutationFn: async () => {
      if (!responseFormFor) return;
      const { error } = await supabase.from("quotation_responses").insert({
        quotation_id: responseFormFor,
        supplier_id: responseForm.supplier_id,
        value: parseFloat(responseForm.value) || 0,
        notes: responseForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_responses"] });
      toast.success("Resposta adicionada!");
      setResponseFormFor(null);
      setResponseForm({ supplier_id: "", value: "0", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteResponse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotation_responses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_responses"] });
      toast.success("Resposta removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelected = useMutation({
    mutationFn: async ({ id, selected }: { id: string; selected: boolean }) => {
      const { error } = await supabase.from("quotation_responses").update({ selected }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation_responses"] });
      toast.success("Fornecedor selecionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", status: "aberta", deadline: "", description: "", obra_id: "" });
    setFormOpen(true);
  };

  const openEdit = (q: Quotation) => {
    setEditing(q);
    setForm({ title: q.title, status: q.status, deadline: q.deadline ?? "", description: q.description ?? "", obra_id: q.obra_id ?? "" });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const filtered = quotations.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColor: Record<string, string> = {
    aberta: "bg-primary/10 text-primary",
    em_analise: "bg-amber-500/10 text-amber-600",
    fechada: "bg-muted text-muted-foreground",
  };

  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">Cotações</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova Cotação
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <input type="text" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma cotação encontrada</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const responses = allResponses.filter((r) => r.quotation_id === q.id);
            const isExpanded = expanded.has(q.id);
            const bestValue = responses.length > 0 ? Math.min(...responses.map((r) => r.value)) : null;
            return (
              <div key={q.id} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggle(q.id)}>
                  <span className="text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                  <span className="font-medium text-foreground flex-1">{q.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[q.status] || "bg-muted text-muted-foreground"}`}>
                    {statusOptions.find((s) => s.value === q.status)?.label ?? q.status}
                  </span>
                  {q.deadline && <span className="text-xs text-muted-foreground">Prazo: {new Date(q.deadline).toLocaleDateString("pt-BR")}</span>}
                  <span className="text-xs text-muted-foreground">{responses.length} resposta{responses.length !== 1 ? "s" : ""}</span>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(q)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm("Remover cotação?")) deleteQuotation.mutate(q.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    {q.description && <div className="px-8 py-2 text-sm text-muted-foreground">{q.description}</div>}

                    {responses.length === 0 ? (
                      <div className="px-8 py-4 text-sm text-muted-foreground">Nenhuma resposta de fornecedor</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/20">
                            <th className="text-left px-8 py-2 font-medium text-muted-foreground">Fornecedor</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Observações</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Selecionado</th>
                            <th className="w-16 px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {responses.map((r) => (
                            <tr key={r.id} className={`hover:bg-muted/20 transition-colors ${r.selected ? "bg-primary/5" : ""}`}>
                              <td className="px-8 py-2 text-foreground">{getSupplierName(r.supplier_id)}</td>
                              <td className={`px-3 py-2 text-right font-medium ${r.value === bestValue ? "text-primary" : "text-foreground"}`}>
                                {fmt(r.value)}
                                {r.value === bestValue && <span className="ml-1 text-xs">⭐</span>}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{r.notes || "—"}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => toggleSelected.mutate({ id: r.id, selected: !r.selected })} className={`p-1 rounded ${r.selected ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground"}`}>
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => { if (confirm("Remover resposta?")) deleteResponse.mutate(r.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Add response form */}
                    {responseFormFor === q.id ? (
                      <div className="px-8 py-3 border-t border-border bg-muted/10 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Fornecedor *</label>
                            <select value={responseForm.supplier_id} onChange={(e) => setResponseForm((p) => ({ ...p, supplier_id: e.target.value }))} className={inputClass + " text-sm"}>
                              <option value="">Selecione...</option>
                              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Valor (R$) *</label>
                            <input type="number" step="0.01" value={responseForm.value} onChange={(e) => setResponseForm((p) => ({ ...p, value: e.target.value }))} className={inputClass + " text-sm"} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Observações</label>
                            <input value={responseForm.notes} onChange={(e) => setResponseForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass + " text-sm"} />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setResponseFormFor(null)} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">Cancelar</button>
                          <button onClick={() => saveResponse.mutate()} disabled={!responseForm.supplier_id || saveResponse.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                            {saveResponse.isPending ? "Salvando..." : "Adicionar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-8 py-2 border-t border-border">
                        <button onClick={() => { setResponseFormFor(q.id); setResponseForm({ supplier_id: "", value: "0", notes: "" }); }} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                          <Plus className="h-3.5 w-3.5" /> Adicionar resposta
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quotation form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Nova"} Cotação</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveQuotation.mutate(); }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Título *</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Obra</label>
                <select value={form.obra_id} onChange={(e) => setForm((p) => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                  <option value="">Nenhuma</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Prazo</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Descrição</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className={inputClass} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saveQuotation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveQuotation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
