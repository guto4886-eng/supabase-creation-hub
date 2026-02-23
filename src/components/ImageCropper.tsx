import { useState, useRef, useCallback } from "react";
import Cropper, { ReactCropperElement } from "react-cropper";
import "react-cropper/node_modules/cropperjs/dist/cropper.css";
import { X, Check } from "lucide-react";

interface Props {
  imageSrc: string;
  aspectRatio?: number;
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}

export default function ImageCropper({ imageSrc, aspectRatio = 1, onCrop, onClose }: Props) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    setSaving(true);
    cropper.getCroppedCanvas({ width: 512, height: 512 }).toBlob(
      (blob) => {
        if (blob) onCrop(blob);
        setSaving(false);
      },
      "image/jpeg",
      0.9
    );
  }, [onCrop]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-card-foreground">Recortar imagem</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <Cropper
            ref={cropperRef}
            src={imageSrc}
            style={{ height: 350, width: "100%" }}
            aspectRatio={aspectRatio}
            guides
            viewMode={1}
            background={false}
          />
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
