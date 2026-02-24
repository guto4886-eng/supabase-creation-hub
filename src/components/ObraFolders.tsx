import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FolderPlus, FolderOpen, Folder, Trash2, Download, FileText, Image, File,
  UploadCloud, ChevronLeft, Plus, X,
} from "lucide-react";

interface Props { obraId: string; }

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  comment: string | null;
  folder: string | null;
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

export default function ObraFolders({ obraId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const entityType = "obra";
  const queryKey = ["attachments", entityType, obraId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments" as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Attachment[];
    },
  });

  // Get unique folders
  const folders = [...new Set(attachments.map(a => a.folder).filter(Boolean))] as string[];

  // Files in current view
  const currentFiles = currentFolder
    ? attachments.filter(a => a.folder === currentFolder)
    : attachments.filter(a => !a.folder);

  const folderFileCounts = (folderName: string) => attachments.filter(a => a.folder === folderName).length;

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) { toast.error("Nome da pasta é obrigatório"); return; }
    if (folders.includes(newFolderName.trim())) { toast.error("Pasta já existe"); return; }
    // Folders are virtual - they exist when files reference them
    // Create a placeholder by just navigating to it
    setCurrentFolder(newFolderName.trim());
    setNewFolderName("");
    setNewFolderModal(false);
    toast.success("Pasta criada! Adicione arquivos nela.");
  };

  const deleteMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const { error: storageError } = await supabase.storage
        .from("attachments")
        .remove([attachment.file_path]);
      if (storageError) throw storageError;
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

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const folderFiles = attachments.filter(a => a.folder === folderName);
      // Delete all files in folder from storage
      if (folderFiles.length > 0) {
        const paths = folderFiles.map(f => f.file_path);
        const { error: storageError } = await supabase.storage
          .from("attachments")
          .remove(paths);
        if (storageError) throw storageError;
        // Delete from DB
        for (const f of folderFiles) {
          const { error } = await supabase.from("attachments" as any).delete().eq("id", f.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setCurrentFolder(null);
      toast.success("Pasta e arquivos removidos!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${entityType}/${obraId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from("attachments" as any).insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: obraId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          content_type: file.type,
          folder: currentFolder || null,
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
  }, [user, entityType, obraId, currentFolder, qc, queryKey]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleDownload = async (attachment: Attachment) => {
    const { data, error } = await supabase.storage.from("attachments").download(attachment.file_path);
    if (error) { toast.error("Erro ao baixar arquivo"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <div className="p-5 space-y-4">
      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentFolder(null)}
            className={`font-medium hover:underline ${!currentFolder ? "text-primary" : "text-muted-foreground"}`}
          >
            📁 Raiz
          </button>
          {currentFolder && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-primary">{currentFolder}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentFolder && (
            <button onClick={() => setCurrentFolder(null)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          <button
            onClick={() => { setNewFolderName(""); setNewFolderModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted"
          >
            <FolderPlus className="h-4 w-4" /> Nova pasta
          </button>
        </div>
      </div>

      {/* Folders grid (only at root level) */}
      {!currentFolder && folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {folders.map(f => (
            <div
              key={f}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => setCurrentFolder(f)}
            >
              <FolderOpen className="h-8 w-8 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{f}</p>
                <p className="text-xs text-muted-foreground">{folderFileCounts(f)} arquivo(s)</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Excluir pasta "${f}" e todos os arquivos?`)) deleteFolderMutation.mutate(f);
                }}
                className="p-1 rounded hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input ref={fileRef} type="file" multiple onChange={handleUpload} disabled={uploading} className="hidden" />
        <UploadCloud className={`h-8 w-8 mx-auto mb-2 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
        {uploading ? (
          <p className="text-sm text-primary font-medium">Enviando...</p>
        ) : (
          <>
            <p className="text-sm text-foreground font-medium">
              {currentFolder ? `Enviar para "${currentFolder}"` : "Clique ou arraste arquivos"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Qualquer tipo de arquivo</p>
          </>
        )}
      </div>

      {/* Files table */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : currentFiles.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {currentFolder ? "Nenhum arquivo nesta pasta" : "Nenhum arquivo na raiz"}
        </p>
      ) : (
        <fieldset className="border border-border rounded-lg p-0 overflow-hidden">
          <legend className="text-sm font-semibold text-muted-foreground px-2 ml-3">
            Arquivos ({currentFiles.length})
          </legend>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Arquivo</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tamanho</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentFiles.map((a) => (
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

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Nova pasta</h3>
              <button onClick={() => setNewFolderModal(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-foreground mb-1">Nome da pasta *</label>
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className={inputClass}
                placeholder="Ex: Projetos, Fotos, Notas Fiscais..."
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
              />
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border bg-muted rounded-b-xl">
              <button onClick={() => setNewFolderModal(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                <FolderPlus className="h-4 w-4" /> Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
