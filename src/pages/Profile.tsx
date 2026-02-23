import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User, Phone, Save, Camera } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "" });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name || "", phone: profile.phone || "" });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (profile) {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: form.full_name, phone: form.phone || null })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, full_name: form.full_name, phone: form.phone || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar avatar");
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("attachments")
      .getPublicUrl(path);

    if (profile) {
      await supabase.from("profiles").update({ avatar_url: publicUrl.publicUrl }).eq("user_id", user.id);
    } else {
      await supabase.from("profiles").insert({ user_id: user.id, full_name: form.full_name || "", avatar_url: publicUrl.publicUrl });
    }

    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Avatar atualizado!");
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Meu Perfil</h2>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 shadow-sm">
            <Camera className="h-3.5 w-3.5" />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
        </div>
        <div>
          <p className="font-medium text-foreground">{profile?.full_name || "Sem nome"}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Form */}
      <div className="border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nome completo</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            className={inputClass}
            placeholder="Seu nome completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className={inputClass}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
          <input value={user?.email ?? ""} disabled className={inputClass + " opacity-60 cursor-not-allowed"} />
          <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
