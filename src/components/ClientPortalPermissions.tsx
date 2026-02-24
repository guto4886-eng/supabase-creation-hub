import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield, Save } from "lucide-react";

interface Props {
  clientId: string;
}

interface Permission {
  id: string;
  module: string;
  platform: string;
  enabled: boolean;
}

const portalModules = [
  { key: "dashboard", label: "Dashboard" },
  { key: "obras", label: "Obras" },
  { key: "financeiro", label: "Financeiro" },
  { key: "documentos", label: "Documentos" },
  { key: "fotos", label: "Fotos" },
  { key: "cronograma", label: "Cronograma" },
  { key: "mensagens", label: "Mensagens" },
];

const appModules = [
  { key: "obras", label: "Obras" },
  { key: "fotos", label: "Fotos" },
  { key: "documentos", label: "Documentos" },
  { key: "mensagens", label: "Mensagens" },
];

type LocalState = Record<string, boolean>; // key: `${platform}:${module}`

function makeKey(platform: string, module: string) {
  return `${platform}:${module}`;
}

export default function ClientPortalPermissions({ clientId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["client_portal_permissions", clientId];

  const { data: permissions = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_permissions" as any)
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return data as unknown as Permission[];
    },
  });

  // Local state mirrors DB, user toggles locally then saves
  const [local, setLocal] = useState<LocalState>({});
  const [dirty, setDirty] = useState(false);

  // Sync local state from DB
  useEffect(() => {
    const state: LocalState = {};
    permissions.forEach((p) => {
      state[makeKey(p.platform, p.module)] = p.enabled;
    });
    setLocal(state);
    setDirty(false);
  }, [permissions]);

  const toggle = (platform: string, module: string, enabled: boolean) => {
    setLocal((prev) => ({ ...prev, [makeKey(platform, module)]: enabled }));
    setDirty(true);
  };

  const toggleAll = (platform: string, modules: { key: string }[], enabled: boolean) => {
    setLocal((prev) => {
      const next = { ...prev };
      modules.forEach((m) => { next[makeKey(platform, m.key)] = enabled; });
      return next;
    });
    setDirty(true);
  };

  const isEnabled = (module: string, platform: string) => local[makeKey(platform, module)] ?? false;
  const allEnabled = (platform: string, modules: { key: string }[]) =>
    modules.every((m) => isEnabled(m.key, platform));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allModules = [
        ...portalModules.map((m) => ({ ...m, platform: "portal" })),
        ...appModules.map((m) => ({ ...m, platform: "app" })),
      ];
      for (const m of allModules) {
        const enabled = local[makeKey(m.platform, m.key)] ?? false;
        const existing = permissions.find((p) => p.module === m.key && p.platform === m.platform);
        if (existing) {
          if (existing.enabled !== enabled) {
            const { error } = await supabase
              .from("client_portal_permissions" as any)
              .update({ enabled } as any)
              .eq("id", existing.id);
            if (error) throw error;
          }
        } else if (enabled) {
          const { error } = await supabase
            .from("client_portal_permissions" as any)
            .insert({ client_id: clientId, user_id: user!.id, module: m.key, platform: m.platform, enabled } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Permissões salvas!");
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderSection = (title: string, platform: string, modules: { key: string; label: string }[]) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={allEnabled(platform, modules)}
            onChange={(e) => toggleAll(platform, modules, e.target.checked)}
            className="rounded border-input"
          />
          Selecionar tudo
        </label>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {modules.map((m) => (
          <label key={m.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={isEnabled(m.key, platform)}
              onChange={(e) => toggle(platform, m.key, e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-foreground">{m.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Portal do Cliente
      </h4>
      <p className="text-xs text-muted-foreground">
        Selecione os módulos que o cliente poderá acessar no Portal e App móvel.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-4"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-4">
          {renderSection("Portal do Cliente", "portal", portalModules)}
          {renderSection("Aplicativo Móvel", "app", appModules)}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !dirty}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
