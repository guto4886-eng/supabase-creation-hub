import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/utils/ccTags";
import { toast } from "sonner";
import {
  Building2, TrendingUp, Wallet, Target, AlertTriangle, Plus,
  Search, ArrowRight, Activity, Sparkles, MoreVertical, Pencil, Trash2,
  ImagePlus, X, Calendar as CalendarIcon, Upload,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type Project = {
  id: string;
  nome: string;
  data_inicio: string;
  imagem_url: string | null;
  ativo: boolean;
};

type Entry = {
  obra_id: string;
  valor_total: number;
  data: string;
  nome_item: string;
};

type Setting = {
  obra_id: string;
  orcamento_previsto: number | null;
};

export default function CentralCustos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["cc-projects", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_projects" as any)
        .select("id,nome,data_inicio,imagem_url,ativo")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["cc-entries-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_cost_entries" as any)
        .select("obra_id,valor_total,data,nome_item")
        .order("data", { ascending: true });
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ["cc-settings-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cc_obra_settings" as any)
        .select("obra_id,orcamento_previsto");
      return (data || []) as any;
    },
    enabled: !!user?.id,
  });

  const enriched = useMemo(() => {
    return projects.map((p) => {
      const ents = entries.filter((e) => e.obra_id === p.id);
      const gasto = ents.reduce((s, e) => s + Number(e.valor_total || 0), 0);
      const cfg = settings.find((s) => s.obra_id === p.id);
      const previsto = Number(cfg?.orcamento_previsto || 0);
      const pct = previsto > 0 ? (gasto / previsto) * 100 : 0;
      const saude: "saudavel" | "atencao" | "risco" =
        previsto === 0 ? "saudavel" : pct >= 90 ? "risco" : pct >= 70 ? "atencao" : "saudavel";
      const buckets: Record<string, number> = {};
      ents.forEach((e) => {
        const k = e.data?.slice(0, 7) || "";
        buckets[k] = (buckets[k] || 0) + Number(e.valor_total || 0);
      });
      const spark = Object.keys(buckets).sort().slice(-6).map((k) => ({ v: buckets[k] }));
      const last = ents[ents.length - 1];
      return { p, gasto, previsto, pct, saude, spark, last };
    });
  }, [projects, entries, settings]);

  const filtered = enriched.filter((e) => {
    if (search && !e.p.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "todos" && e.saude !== statusFilter) return false;
    return true;
  });

  const kpis = useMemo(() => {
    const ativas = enriched.length;
    const custoTotal = enriched.reduce((s, e) => s + e.gasto, 0);
    const orcTotal = enriched.reduce((s, e) => s + e.previsto, 0);
    const margem = orcTotal - custoTotal;
    const risco = enriched.filter((e) => e.saude === "risco").length;
    return { ativas, custoTotal, orcTotal, margem, risco };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta obra da Central de Custos? Os lançamentos vinculados permanecerão no histórico.")) return;
    const { error } = await supabase.from("cc_projects" as any).update({ ativo: false }).eq("id", id);
    if (error) return toast.error("Erro ao excluir obra");
    toast.success("Obra excluída");
    qc.invalidateQueries({ queryKey: ["cc-projects"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Módulo independente
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            Central de Custos
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle financeiro rápido e visual por obra
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/20 hover:opacity-90 transition-all hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" /> Nova Obra
        </button>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-8">
        {[
          { icon: Building2, label: "Obras Ativas", value: kpis.ativas, fmt: false, color: "from-blue-500/10 to-blue-500/0", ico: "text-blue-500" },
          { icon: Wallet, label: "Custo Total", value: kpis.custoTotal, fmt: true, color: "from-rose-500/10 to-rose-500/0", ico: "text-rose-500" },
          { icon: Target, label: "Orçamento Previsto", value: kpis.orcTotal, fmt: true, color: "from-indigo-500/10 to-indigo-500/0", ico: "text-indigo-500" },
          { icon: TrendingUp, label: "Margem Estimada", value: kpis.margem, fmt: true, color: "from-emerald-500/10 to-emerald-500/0", ico: "text-emerald-500" },
          { icon: AlertTriangle, label: "Obras em Risco", value: kpis.risco, fmt: false, color: "from-amber-500/10 to-amber-500/0", ico: "text-amber-500" },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${k.color} pointer-events-none`} />
            <div className="relative">
              <div className={`inline-flex p-2 rounded-xl bg-background/60 backdrop-blur ${k.ico}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{k.label}</p>
              <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 tabular-nums">
                {k.fmt ? formatBRL(k.value as number) : k.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-3 lg:p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar obra..."
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-background text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 px-3 rounded-xl border border-border bg-background text-sm"
        >
          <option value="todos">Todos status</option>
          <option value="saudavel">Saudável</option>
          <option value="atencao">Atenção</option>
          <option value="risco">Risco</option>
        </select>
      </div>

      {/* Cards de obras */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Nenhuma obra cadastrada ainda.</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Criar primeira obra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e, i) => (
            <motion.div
              key={e.p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              {/* Imagem */}
              <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-muted overflow-hidden">
                {e.p.imagem_url ? (
                  <img src={e.p.imagem_url} alt={e.p.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                <span
                  className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur ${
                    e.saude === "saudavel"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : e.saude === "atencao"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <Activity className="h-3 w-3" />
                  {e.saude === "saudavel" ? "Saudável" : e.saude === "atencao" ? "Atenção" : "Risco"}
                </span>

                {/* Menu ações */}
                <div className="absolute top-3 left-3">
                  <button
                    onClick={(ev) => { ev.preventDefault(); setMenuOpen(menuOpen === e.p.id ? null : e.p.id); }}
                    className="p-1.5 rounded-lg bg-background/80 backdrop-blur hover:bg-background transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === e.p.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute left-0 top-9 z-20 w-44 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                        <Link
                          to={`/central-custos/${e.p.id}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full"
                          onClick={() => setMenuOpen(null)}
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Abrir Central
                        </Link>
                        <button
                          onClick={() => { setEditing(e.p); setModalOpen(true); setMenuOpen(null); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full text-left"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => { handleDelete(e.p.id); setMenuOpen(null); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive w-full text-left"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-semibold text-foreground text-lg truncate">{e.p.nome}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <CalendarIcon className="h-3 w-3" />
                  Início: {new Date(e.p.data_inicio).toLocaleDateString("pt-BR")}
                </p>

                {e.previsto > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Consumido</span>
                      <span className="font-semibold tabular-nums">{e.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          e.saude === "risco" ? "bg-rose-500" : e.saude === "atencao" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, e.pct)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Gasto</p>
                    <p className="font-semibold tabular-nums">{formatBRL(e.gasto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previsto</p>
                    <p className="font-semibold tabular-nums">{formatBRL(e.previsto)}</p>
                  </div>
                </div>

                {e.spark.length > 1 && (
                  <div className="h-10 mt-3 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={e.spark}>
                        <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {e.last && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Último: <span className="text-foreground">{e.last.nome_item}</span>
                  </p>
                )}

                <Link
                  to={`/central-custos/${e.p.id}`}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  Abrir Central <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <ProjectModal
            project={editing}
            onClose={() => setModalOpen(false)}
            onSaved={() => {
              setModalOpen(false);
              qc.invalidateQueries({ queryKey: ["cc-projects"] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(project?.nome || "");
  const [dataInicio, setDataInicio] = useState(project?.data_inicio || new Date().toISOString().slice(0, 10));
  const [imagemUrl, setImagemUrl] = useState<string | null>(project?.imagem_url || null);
  const [orcamentoPrevisto, setOrcamentoPrevisto] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carrega orçamento previsto existente ao editar
  useEffect(() => {
    if (!project) return;
    (async () => {
      const { data } = await supabase
        .from("cc_obra_settings" as any)
        .select("orcamento_previsto")
        .eq("obra_id", project.id)
        .maybeSingle();
      const val = (data as any)?.orcamento_previsto;
      if (val != null) setOrcamentoPrevisto(String(val));
    })();
  }, [project]);

  const upload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/cc-projects/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("cc-comprovantes").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("cc-comprovantes").createSignedUrl(path, 60 * 60 * 24 * 365);
      setImagemUrl(data?.signedUrl || null);
    } catch (e: any) {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome da obra");
    if (!user) return;
    setSaving(true);
    try {
      const orcNum = orcamentoPrevisto === "" ? null : Number(orcamentoPrevisto);
      let obraId = project?.id;
      if (project) {
        const { error } = await supabase
          .from("cc_projects" as any)
          .update({ nome: nome.trim(), data_inicio: dataInicio, imagem_url: imagemUrl })
          .eq("id", project.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("cc_projects" as any)
          .insert({ nome: nome.trim(), data_inicio: dataInicio, imagem_url: imagemUrl, user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        obraId = (data as any)?.id;
      }

      // Upsert orçamento previsto em cc_obra_settings
      if (obraId && orcNum != null) {
        const { error: sErr } = await supabase
          .from("cc_obra_settings" as any)
          .upsert(
            { obra_id: obraId, user_id: user.id, orcamento_previsto: orcNum },
            { onConflict: "obra_id" }
          );
        if (sErr) throw sErr;
      }

      toast.success(project ? "Obra atualizada" : "Obra criada");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <h2 className="text-lg font-bold">{project ? "Editar Obra" : "Nova Obra"}</h2>
            <p className="text-xs text-muted-foreground">Cadastro rápido — comece a lançar custos em segundos</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Nome da Obra <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Residencial Aurora"
              className="w-full h-11 px-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Data de Início <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Imagem da Obra (opcional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            {imagemUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={imagemUrl} alt="capa" className="w-full h-32 object-cover" />
                <button
                  onClick={() => setImagemUrl(null)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
              >
                {uploading ? (
                  <p className="text-sm text-muted-foreground">Enviando...</p>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Arraste uma imagem ou clique</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG até 5MB</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? "Salvando..." : project ? "Salvar" : "Criar Obra"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
