import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield } from "lucide-react";

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

  const toggleMutation = useMutation({
    mutationFn: async ({ module, platform, enabled }: { module: string; platform: string; enabled: boolean }) => {
      const existing = permissions.find((p) => p.module === module && p.platform === platform);
      if (existing) {
        const { error } = await supabase
          .from("client_portal_permissions" as any)
          .update({ enabled } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_portal_permissions" as any)
          .insert({ client_id: clientId, user_id: user!.id, module, platform, enabled } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isEnabled = (module: string, platform: string) => {
    const perm = permissions.find((p) => p.module === module && p.platform === platform);
    return perm ? perm.enabled : false;
  };

  const allEnabled = (platform: string, modules: { key: string }[]) =>
    modules.every((m) => isEnabled(m.key, platform));

  const toggleAll = (platform: string, modules: { key: string }[], enabled: boolean) => {
    modules.forEach((m) => toggleMutation.mutate({ module: m.key, platform, enabled }));
  };

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
              onChange={(e) => toggleMutation.mutate({ module: m.key, platform, enabled: e.target.checked })}
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
        </div>
      )}
    </div>
  );
}
