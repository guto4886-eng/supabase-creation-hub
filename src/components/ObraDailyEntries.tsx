import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, MessageSquareWarning, X } from "lucide-react";

interface Props { obraId: string; }

const MSG_MAX = 10000;

const PHASES = [
  "Fundação", "Estrutura", "Alvenaria", "Cobertura",
  "Instalações elétricas", "Instalações hidráulicas",
  "Revestimento", "Pintura", "Acabamento", "Limpeza",
];

const SERVICES = [
  "Serviço interno", "Serviço externo", "Manutenção",
  "Vistoria", "Entrega de material", "Outro",
];

export default function ObraDailyEntries({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [phase, setPhase] = useState("");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");
  const [showToClient, setShowToClient] = useState(false);

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["obra_daily_entries", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_daily_entries" as any)
        .select("*")
        .eq("obra_id", obraId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const resetForm = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPhase("");
    setService("");
    setMessage("");
    setShowToClient(false);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Mensagem é obrigatória");
      const { error } = await supabase.from("obra_daily_entries" as any).insert({
        obra_id: obraId,
        user_id: user!.id,
        message: message.trim(),
        entry_date: entryDate,
        phase: phase || null,
        service: service || null,
        show_to_client: showToClient,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_daily_entries", obraId] });
      resetForm();
      setModalOpen(false);
      toast.success("Entrada adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_daily_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_daily_entries", obraId] });
      toast.success("Removido!");
    },
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";
  const remaining = MSG_MAX - message.length;

  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => refetch()} className="text-primary text-xs hover:underline flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
        <button
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo registro
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
            <MessageSquareWarning className="h-12 w-12 text-amber-400" />
            <p className="text-sm font-medium text-amber-600">NENHUMA MENSAGEM ENCONTRADA.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fase</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Serviço</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mensagem</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cliente</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{formatDate(e.entry_date)}</td>
                  <td className="px-3 py-2 text-foreground">{e.phase || "—"}</td>
                  <td className="px-3 py-2 text-foreground">{e.service || "—"}</td>
                  <td className="px-3 py-2 text-foreground max-w-xs truncate">{e.message}</td>
                  <td className="px-3 py-2 text-foreground">{e.show_to_client ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(e.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Novo registro</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Data */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground w-28 text-right shrink-0">Data *</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={`${inputClass} max-w-[180px]`} />
              </div>

              {/* Fase + Serviço */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground w-28 text-right shrink-0">Fase obra</label>
                <select value={phase} onChange={(e) => setPhase(e.target.value)} className={`${inputClass} flex-1`}>
                  <option value="">Selecione...</option>
                  {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <label className="text-sm font-medium text-foreground shrink-0">Serviço</label>
                <select value={service} onChange={(e) => setService(e.target.value)} className={`${inputClass} flex-1`}>
                  <option value="">Selecione...</option>
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Mensagem */}
              <div className="flex items-start gap-3">
                <label className="text-sm font-medium text-foreground w-28 text-right shrink-0 mt-2">Mensagem *</label>
                <div className="flex-1">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MSG_MAX))}
                    placeholder="Digite sua mensagem..."
                    rows={4}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {remaining.toLocaleString("pt-BR")} caracteres restantes
                  </p>
                </div>
              </div>

              {/* Exibir ao cliente */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground w-28 text-right shrink-0">Exibir ao cliente?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                    <input type="radio" checked={!showToClient} onChange={() => setShowToClient(false)} className="accent-primary" /> Não
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                    <input type="radio" checked={showToClient} onChange={() => setShowToClient(true)} className="accent-primary" /> Sim
                  </label>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 p-5 border-t border-border bg-muted rounded-b-xl">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !message.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
