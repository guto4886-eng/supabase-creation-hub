import { useState } from "react";
import { FileText, FileSpreadsheet, File, X } from "lucide-react";

interface ExportDialogProps {
  onSelect: (format: "csv" | "pdf" | "excel") => void;
  onClose: () => void;
}

const formats = [
  { key: "csv" as const, label: "CSV", desc: "Planilha compatível com Excel", icon: FileText },
  { key: "excel" as const, label: "Excel (.xlsx)", desc: "Formato nativo do Excel", icon: FileSpreadsheet },
  { key: "pdf" as const, label: "PDF", desc: "Documento com cabeçalho da empresa", icon: File },
];

export default function ExportDialog({ onSelect, onClose }: ExportDialogProps) {
  const [selected, setSelected] = useState<"csv" | "pdf" | "excel" | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Exportar como</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => setSelected(f.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                selected === f.key
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border hover:bg-muted/50 text-foreground"
              }`}
            >
              <f.icon className={`h-5 w-5 ${selected === f.key ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
}
