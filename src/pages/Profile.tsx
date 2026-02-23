import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User, Save, Camera, Lock, Bell, Eye, EyeOff, Check, X as XIcon } from "lucide-react";
import ImageCropper from "@/components/ImageCropper";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Password change
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);

  const passwordCriteria = {
    length: passwordForm.password.length >= 8,
    uppercase: /[A-Z]/.test(passwordForm.password) && /[a-z]/.test(passwordForm.password),
    number: /[0-9]/.test(passwordForm.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.password),
  };
  const criteriaMet = Object.values(passwordCriteria).filter(Boolean).length;
  const strengthPercent = (criteriaMet / 4) * 100;
  const strengthColor = criteriaMet <= 1 ? "bg-destructive" : criteriaMet <= 2 ? "bg-orange-500" : criteriaMet <= 3 ? "bg-yellow-500" : "bg-green-500";

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

  const { data: preferences } = useQuery({
    queryKey: ["user_preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as UserPreferences | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name || "", phone: profile.phone || "" });
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.email_notifications);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      // Save profile
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
      // Save preferences
      if (preferences) {
        const { error } = await supabase
          .from("user_preferences" as any)
          .update({ email_notifications: emailNotifications } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences" as any)
          .insert({ user_id: user.id, email_notifications: emailNotifications } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["user_preferences"] });
      toast.success("Perfil atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    if (!user) return;
    setCropperSrc(null);
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

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
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
      toast.error("Erro inesperado ao salvar avatar");
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;
    try {
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Avatar removido!");
    } catch (error) {
      console.error("Erro ao remover avatar:", error);
      toast.error("Erro inesperado");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.values(passwordCriteria).every(Boolean)) {
      toast.error("A senha não atende aos critérios mínimos");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Senha alterada com sucesso!");
        setPasswordOpen(false);
        setPasswordForm({ password: "", confirm: "" });
      }
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      toast.error("Erro inesperado ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
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
        <div className="relative group">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 shadow-sm">
            <Camera className="h-3.5 w-3.5" />
            <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
          </label>
        </div>
        <div>
          <p className="font-medium text-foreground">{profile?.full_name || "Sem nome"}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {profile?.avatar_url && (
            <button onClick={handleRemoveAvatar} className="text-xs text-destructive hover:underline mt-1">
              Remover imagem
            </button>
          )}
        </div>
      </div>

      {/* Dados */}
      <div className="border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <User className="h-4 w-4" /> Dados
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            className={inputClass}
            placeholder="Seu nome completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Celular *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className={inputClass}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Login/e-mail *</label>
          <input value={user?.email ?? ""} disabled className={inputClass + " opacity-60 cursor-not-allowed"} />
          <p className="text-xs text-muted-foreground mt-1">O e-mail não pode ser alterado</p>
        </div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">Senha</label>
          <button
            onClick={() => setPasswordOpen(!passwordOpen)}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            <Lock className="h-3.5 w-3.5" /> Alterar senha
          </button>
        </div>
        {passwordOpen && (
          <form onSubmit={handleChangePassword} className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className={inputClass + " text-sm pr-9"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Confirmar senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                  required
                  placeholder="Repita a senha"
                  className={inputClass + " text-sm pr-9"}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Strength bar */}
            {passwordForm.password.length > 0 && (
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-300 rounded-full ${strengthColor}`} style={{ width: `${strengthPercent}%` }} />
                </div>
                <ul className="grid grid-cols-2 gap-1 text-xs">
                  {([
                    [passwordCriteria.length, "8 caracteres, no mínimo"],
                    [passwordCriteria.uppercase, "Letras minúsculas e maiúsculas"],
                    [passwordCriteria.number, "Números (0-9)"],
                    [passwordCriteria.special, "Símbolos (!@#$%^&*)"],
                  ] as [boolean, string][]).map(([met, label]) => (
                    <li key={label} className={`flex items-center gap-1 ${met ? "text-green-600" : "text-muted-foreground"}`}>
                      {met ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPasswordOpen(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted">
                Cancelar
              </button>
              <button type="submit" disabled={changingPassword} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {changingPassword ? "Alterando..." : "Alterar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Preferências */}
      <div className="border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Bell className="h-4 w-4" /> Preferências
        </h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <span className="text-sm text-foreground">Receber e-mails com notificações do sistema</span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Image Cropper */}
      {cropperSrc && (
        <ImageCropper
          imageSrc={cropperSrc}
          aspectRatio={1}
          onCrop={handleCroppedAvatar}
          onClose={() => setCropperSrc(null)}
        />
      )}
    </div>
  );
}
