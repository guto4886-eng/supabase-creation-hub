import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { useCompanies } from "@/hooks/useCompanies";

interface FinancialDoc {
  id: string;
  description: string;
  type: string;
  value: number;
  status: string;
  due_date: string | null;
  payment_date: string | null;
  category: string | null;
  notes: string | null;
  obra_id: string | null;
  supplier_id: string | null;
  created_at: string;
}

const typeOptions = [
  { value: "despesa", label: "Despesa" },
  { value: "receita", label: "Receita" },
];

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "cancelado", label: "Cancelado" },
];

const PAGE_SIZE = 15;

export default function Financial() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [editing, setEditing] = useState<FinancialDoc | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    description: "", type: "despesa", value: "0", status: "pendente",
    due_date: "", payment_date: "", category: "", notes: "", obra_id: "", supplier_id: "",
  });
  const [page, setPage] = useState(0);

  const { data: companiesList = [] } = useCompanies();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financial_docs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_docs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinancialDoc[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description,
        type: form.type,
        value: parseFloat(form.value) || 0,
        status: form.status,
        due_date: form.due_date || null,
        payment_date: form.payment_date || null,
        category: form.category || null,
        notes: form.notes || null,
        obra_id: form.obra_id || null,
        supplier_id: form.supplier_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("financial_docs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_docs").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_docs"] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_docs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_docs"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ description: "", type: "despesa", value: "0", status: "pendente", due_date: "", payment_date: "", category: "", notes: "", obra_id: "", supplier_id: "" });
    setFormOpen(true);
  };

  const openEdit = (item: FinancialDoc) => {
    setEditing(item);
    setForm({
      description: item.description,
      type: item.type,
      value: String(item.value),
      status: item.status,
      due_date: item.due_date ?? "",
      payment_date: item.payment_date ?? "",
      category: item.category ?? "",
      notes: item.notes ?? "",
      obra_id: item.obra_id ?? "",
      supplier_id: item.supplier_id ?? "",
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const filtered = items.filter((item) => {
    if (!item.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCompany && (item as any).company_id !== filterCompany) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColor: Record<string, string> = {
    pendente: "bg-amber-500/10 text-amber-600",
    pago: "bg-primary/10 text-primary",
    cancelado: "bg-muted text-muted-foreground",
  };

  const typeColor: Record<string, string> = {
    receita: "text-emerald-600",
    despesa: "text-destructive",
  };

  const getObraName = (id: string | null) => id ? obras.find((o) => o.id === id)?.name ?? "—" : "—";
  const getSupplierName = (id: string | null) => id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">Financeiro</h2>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={() => exportToCSV(filtered, [{ name: "description", label: "Descrição" }, { name: "type", label: "Tipo" }, { name: "value", label: "Valor" }, { name: "status", label: "Status" }, { name: "due_date", label: "Vencimento" }, { name: "category", label: "Categoria" }], "financeiro")} className="flex items-center gap-2 px-4 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              <Download className="h-4 w-4" /> Exportar
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="w-56">
          <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setPage(0); }} className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm">
            <option value="">Todas empresas</option>
            {companiesList.map((c) => (
              <option key={c.id} value={c.id}>{c.company_type === "filial" ? "↳ " : ""}{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Obra</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground">{item.description}</td>
                    <td className={`px-4 py-3 font-medium ${typeColor[item.type] || "text-foreground"}`}>
                      {typeOptions.find((o) => o.value === item.type)?.label ?? item.type}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${typeColor[item.type] || "text-foreground"}`}>{fmt(item.value)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[item.status] || "bg-muted text-muted-foreground"}`}>
                        {statusOptions.find((o) => o.value === item.status)?.label ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getObraName(item.obra_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getSupplierName(item.supplier_id)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-md text-sm font-medium ${i === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"}`}>{i + 1}</button>
                )).slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3))}
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Novo"} Documento</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Descrição *</label>
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Tipo *</label>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} required className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Categoria</label>
                  <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Vencimento</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Pagamento</label>
                  <input type="date" value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Obra</label>
                  <select value={form.obra_id} onChange={(e) => setForm((p) => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                    <option value="">Nenhuma</option>
                    {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Fornecedor</label>
                  <select value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))} className={inputClass}>
                    <option value="">Nenhum</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Observações</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
