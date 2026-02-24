import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

interface Props {
  supplierId: string;
}

const CATEGORY_SUGGESTIONS = [
  "Material de Construção", "Elétrica", "Hidráulica", "Pintura", "Acabamento",
  "Ferramentas", "EPI", "Concreto", "Aço", "Madeira", "Vidros", "Esquadrias",
  "Impermeabilização", "Terraplanagem", "Transporte", "Locação de Equipamentos",
];

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

export default function SupplierCategories({ supplierId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newCategory, setNewCategory] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supplier_categories", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_categories").select("*").eq("supplier_id", supplierId).order("category");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async (category: string) => {
      const { error } = await supabase.from("supplier_categories").insert({
        supplier_id: supplierId, user_id: user!.id, category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_categories", supplierId] });
      setNewCategory("");
      toast.success("Categoria adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_categories", supplierId] });
      toast.success("Removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingCategories = items.map((i: any) => i.category);
  const suggestions = CATEGORY_SUGGESTIONS.filter(c => !existingCategories.includes(c));

  const handleAdd = (cat: string) => {
    if (!cat.trim()) return;
    if (existingCategories.includes(cat)) { toast.error("Categoria já adicionada"); return; }
    add.mutate(cat.trim());
  };

  return (
    <div className="p-6 space-y-4">
      <h4 className="text-sm font-semibold text-foreground">Categorias</h4>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {items.map((item: any) => (
              <span key={item.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {item.category}
                <button onClick={() => { if (confirm("Remover?")) remove.mutate(item.id); }} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria</p>}
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">Nova categoria</label>
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(newCategory); } }} placeholder="Digite ou selecione abaixo..." className={inputClass} />
            </div>
            <button onClick={() => handleAdd(newCategory)} disabled={!newCategory.trim() || add.isPending} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(cat => (
                  <button key={cat} onClick={() => handleAdd(cat)} className="px-2.5 py-1 border border-border rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    + {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
