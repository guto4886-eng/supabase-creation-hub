import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Paperclip, Trash2, Download, FileText, Image, File } from "lucide-react";

interface Props {
  entityType: string;
  entityId: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  comment: string | null;
  created_at: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ contentType }: { contentType: string | null }) {
  if (contentType?.startsWith("image/")) return <Image className="h-4 w-4 text-primary" />;
  if (contentType?.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function Attachments({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const queryKey = ["attachments", entityType, entityId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments" as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Attachment[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("attachments")
        .remove([attachment.file_path]);
      if (storageError) throw storageError;

      // Delete from DB
      const { error } = await supabase
        .from("attachments" as any)
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Anexo removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${entityType}/${entityId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("attachments" as any)
          .insert({
            user_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            content_type: file.type,
          } as any);
        if (dbError) throw dbError;
      }
      qc.invalidateQueries({ queryKey });
      toast.success("Arquivo(s) enviado(s)!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .download(attachment.file_path);
    if (error) {
      toast.error("Erro ao baixar arquivo");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Anexos ({attachments.length})
        </h4>
        <label className="cursor-pointer px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          {uploading ? "Enviando..." : "Adicionar"}
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum anexo</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <FileIcon contentType={a.content_type} />
              <span className="flex-1 truncate text-foreground">{a.file_name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatFileSize(a.file_size)}
              </span>
              <button
                onClick={() => handleDownload(a)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Baixar"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { if (confirm("Remover anexo?")) deleteMutation.mutate(a); }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
