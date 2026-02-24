import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Paperclip, Trash2, Download, FileText, Image, File, UploadCloud } from "lucide-react";

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
  const [dragging, setDragging] = useState(false);

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

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
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
  }, [user, entityType, entityId, qc, queryKey]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

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
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <UploadCloud className={`h-10 w-10 mx-auto mb-3 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        {uploading ? (
          <p className="text-sm text-primary font-medium">Enviando...</p>
        ) : (
          <>
            <p className="text-sm text-foreground font-medium">
              Clique para selecionar ou arraste arquivos aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">Qualquer tipo de arquivo</p>
          </>
        )}
      </div>

      {/* Attachments list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum anexo</p>
      ) : (
        <fieldset className="border border-border rounded-lg p-0 overflow-hidden">
          <legend className="text-sm font-semibold text-muted-foreground px-2 ml-3">Anexos ({attachments.length})</legend>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Arquivo</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tamanho</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attachments.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-foreground">
                    <div className="flex items-center gap-2">
                      <FileIcon contentType={a.content_type} />
                      <span className="truncate">{a.file_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatFileSize(a.file_size)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleDownload(a)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Baixar">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { if (confirm("Remover anexo?")) deleteMutation.mutate(a); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      )}
    </div>
  );
}
