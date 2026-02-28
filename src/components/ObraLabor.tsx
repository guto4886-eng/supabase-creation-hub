import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Users, Power, RefreshCw } from "lucide-react";

interface Props { obraId: string; }

const ROLES = [
  "Pedreiro", "Servente", "Mestre de obras", "Encanador", "Eletricista",
  "Pintor", "Carpinteiro", "Armador", "Azulejista", "Gesseiro",
  "Serralheiro", "Engenheiro", "Arquiteto", "Técnico de segurança", "Outro",
];

export default function ObraLabor({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["obra_labor", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_labor" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const resetForm = () => {
    setForm({ name: "", role: "", daily_rate: "", start_date: "", end_date: "", phone: "", document: "", notes: "", active: true });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setModalOpen(true); };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name || "", role: item.role || "", daily_rate: item.daily_rate ?? "",
      start_date: item.start_date || "", end_date: item.end_date || "",
      phone: item.phone || "", document: item.document || "", notes: item.notes || "", active: item.active,
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Nome é obrigatório");
      const payload: any = {
        obra_id: obraId, user_id: user!.id, name: form.name.trim(),
        role: form.role || null, daily_rate: form.daily_rate ? Number(form.daily_rate) : 0,
        start_date: form.start_date || null, end_date: form.end_date || null,
        phone: form.phone || null, document: form.document || null,
        notes: form.notes || null, active: form.active,
      };
      if (editing) {
        const { error } = await supabase.from("obra_labor" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obra_labor" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_labor", obraId] });
      setModalOpen(false);
      resetForm();
      toast.success(editing ? "Atualizado!" : "Adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_labor" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_labor", obraId] });
      toast.success("Removido!");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("obra_labor" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_labor", obraId] });
      toast.success("Status atualizado!");
    },
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const activeEntries = entries.filter((e: any) => e.active);
  const inactiveEntries = entries.filter((e: any) => !e.active);

  return (
    <div className="p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => refetch()} className="text-primary text-xs hover:underline flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo colaborador
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
            <Users className="h-12 w-12 text-amber-400" />
            <p className="text-sm font-medium text-amber-600">NENHUM COLABORADOR CADASTRADO.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Função</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Diária</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Início</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fim</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                <th className="w-24 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...activeEntries, ...inactiveEntries].map((e: any) => (
                <tr key={e.id} className={`hover:bg-muted/30 ${!e.active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 text-foreground font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-foreground">{e.role || "—"}</td>
                  <td className="px-3 py-2 text-foreground">{e.daily_rate ? formatCurrency(Number(e.daily_rate)) : "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatDate(e.start_date)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatDate(e.end_date)}</td>
                  <td className="px-3 py-2 text-foreground">{e.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${e.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {e.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleActive.mutate({ id: e.id, active: !e.active })} className={`p-1 rounded ${e.active ? "hover:bg-amber-100 text-amber-600" : "hover:bg-primary/10 text-primary"}`} title={e.active ? "Desativar" : "Ativar"}>
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(e.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">{editing ? "Editar colaborador" : "Novo colaborador"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
                  <input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Função</label>
                  <select value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Diária (R$)</label>
                  <input type="number" step="0.01" value={form.daily_rate || ""} onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data início</label>
                  <input type="date" value={form.start_date || ""} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data fim</label>
                  <input type="date" value={form.end_date || ""} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
                  <input value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">CPF/Documento</label>
                  <input value={form.document || ""} onChange={e => setForm(p => ({ ...p, document: e.target.value }))} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                  <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
                </div>
                {editing && (
                  <div className="col-span-2 flex items-center gap-3">
                    <label className="text-sm font-medium text-foreground">Ativo?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" checked={form.active === true} onChange={() => setForm(p => ({ ...p, active: true }))} className="accent-primary" /> Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" checked={form.active === false} onChange={() => setForm(p => ({ ...p, active: false }))} className="accent-primary" /> Não
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-border bg-muted rounded-b-xl">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">Cancelar</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name?.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Plus className="h-4 w-4" /> {editing ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
