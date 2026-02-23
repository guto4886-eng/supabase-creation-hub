import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";
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
}

export default function CrudPage({ table, queryKey, title, fields, defaultValues = {} }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

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

  const tableFields = fields.filter((f) => !f.hideInTable);
  const filtered = items.filter((item) =>
    tableFields.some((f) => String(item[f.name] ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {tableFields.map((f) => (
                  <th key={f.name} className="text-left px-4 py-3 font-medium text-muted-foreground">{f.label}</th>
                ))}
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
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
                  {f.type === "textarea" ? (
                    <textarea
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                      required={f.required}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : f.type === "select" ? (
                    <select
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                      required={f.required}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Selecione...</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type ?? "text"}
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                      required={f.required}
                      step={f.type === "number" ? "0.01" : undefined}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
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
