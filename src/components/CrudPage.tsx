import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { fetchCep } from "@/utils/cep";
import { maskCpfCnpj, validateCpfCnpj } from "@/utils/cpfCnpj";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "cep" | "cpfcnpj";
  options?: { value: string; label: string }[];
  required?: boolean;
  hideInTable?: boolean;
}

interface Props {
  table: string;
  queryKey: string;
  title: string;
  fields: FieldDef[];
  defaultValues?: Record<string, any>;
  hasActive?: boolean;
}

const PAGE_SIZE = 15;

export default function CrudPage({ table, queryKey, title, fields, defaultValues = {}, hasActive = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [page, setPage] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (editing) {
        const { error } = await supabase.from(table as any).update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert({ ...values, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(editing ? "Atualizado!" : "Criado!");
      closeForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from(table as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    const initial: Record<string, any> = {};
    fields.forEach((f) => (initial[f.name] = defaultValues[f.name] ?? ""));
    setForm(initial);
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const initial: Record<string, any> = {};
    fields.forEach((f) => (initial[f.name] = item[f.name] ?? ""));
    setForm(initial);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleCepBlur = async (value: string) => {
    setCepLoading(true);
    const result = await fetchCep(value);
    setCepLoading(false);
    if (result) {
      setForm((p) => ({
        ...p,
        city: result.city,
        state: result.state,
        address: result.address,
      }));
      toast.success("Endereço preenchido!");
    } else if (value.replace(/\D/g, "").length === 8) {
      toast.error("CEP não encontrado");
    }
  };

  const tableFields = fields.filter((f) => !f.hideInTable);
  const filtered = items.filter((item) =>
    tableFields.some((f) => String(item[f.name] ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const renderInput = (f: FieldDef) => {
    if (f.type === "textarea") {
      return (
        <textarea
          value={form[f.name] ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
          required={f.required}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      );
    }
    if (f.type === "select") {
      return (
        <select
          value={form[f.name] ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
          required={f.required}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Selecione...</option>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === "cep") {
      return (
        <div className="relative">
          <input
            type="text"
            value={form[f.name] ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 8);
              const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
              setForm((p) => ({ ...p, [f.name]: formatted }));
            }}
            onBlur={(e) => handleCepBlur(e.target.value)}
            placeholder="00000-000"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {cepLoading && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      );
    }
    if (f.type === "cpfcnpj") {
      const val = form[f.name] ?? "";
      const digits = val.replace(/\D/g, "");
      const isComplete = digits.length === 11 || digits.length === 14;
      const { valid } = isComplete ? validateCpfCnpj(val) : { valid: true };
      return (
        <div>
          <input
            type="text"
            value={val}
            onChange={(e) => {
              const masked = maskCpfCnpj(e.target.value);
              setForm((p) => ({ ...p, [f.name]: masked }));
            }}
            placeholder="CPF ou CNPJ"
            className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
              isComplete && !valid ? "border-destructive" : "border-input"
            }`}
          />
          {isComplete && !valid && (
            <p className="text-xs text-destructive mt-1">
              {digits.length === 11 ? "CPF" : "CNPJ"} inválido
            </p>
          )}
        </div>
      );
    }
    return (
      <input
        type={f.type ?? "text"}
        value={form[f.name] ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
        required={f.required}
        step={f.type === "number" ? "0.01" : undefined}
        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={() => exportToCSV(filtered, tableFields, queryKey)}
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" /> Exportar
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
                  {hasActive && <th className="w-16 px-4 py-3 font-medium text-muted-foreground">Ativo</th>}
                  {tableFields.map((f) => (
                    <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground">{f.label}</th>
                  ))}
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${hasActive && !item.active ? "opacity-50" : ""}`}>
                    {hasActive && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive.mutate({ id: item.id, active: !item.active })}
                          className={`relative h-6 w-11 rounded-full transition-colors ${item.active ? "bg-primary" : "bg-muted-foreground/30"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${item.active ? "translate-x-5" : ""}`} />
                        </button>
                      </td>
                    )}
                    {tableFields.map((f) => (
                      <td key={f.name} className="px-4 py-3 text-foreground">{String(item[f.name] ?? "—")}</td>
                    ))}
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
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${i === currentPage ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"}`}>{i + 1}</button>
                )).slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3))}
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">{editing ? "Editar" : "Novo"} {title.replace(/s$/, "")}</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-card-foreground mb-1">{f.label}</label>
                  {renderInput(f)}
                </div>
              ))}
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
