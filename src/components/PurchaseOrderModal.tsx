import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Search, Plus, Trash2, Pencil } from "lucide-react";
import { useCompanies, CompanyFilterSelect } from "@/hooks/useCompanies";
import Attachments from "@/components/Attachments";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovada", label: "Aprovada" },
  { value: "enviada", label: "Enviada ao fornecedor" },
  { value: "recebida", label: "Recebida" },
  { value: "cancelada", label: "Cancelada" },
];

const TABS = [
  { key: "dados", label: "Dados" },
  { key: "pagamento", label: "Pagamento" },
  { key: "anexos", label: "Anexos" },
] as const;
type TabKey = typeof TABS[number]["key"];

interface OrderItem {
  id?: string;
  item_type: string;
  insumo_id?: string;
  description: string;
  brand: string;
  complement: string;
  obra_id: string;
  phase: string;
  service: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_value: number;
  discount_percent: number;
  freight: number;
  total: number;
}

interface Insumo {
  id: string;
  name: string;
  unit: string;
  category: string | null;
}

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function calcItemTotal(item: OrderItem) {
  const subtotal = item.quantity * item.unit_price;
  let disc = item.discount_value || 0;
  if (item.discount_percent > 0) disc = subtotal * (item.discount_percent / 100);
  return Math.max(0, subtotal - disc + (item.freight || 0));
}

export default function PurchaseOrderModal({
  open, onClose, editing, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: any | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("dados");
  const [form, setForm] = useState<Record<string, any>>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  const emptyItem: OrderItem = {
    item_type: "insumo", description: "", brand: "", complement: "",
    obra_id: "", phase: "", service: "", quantity: 1, unit: "un",
    unit_price: 0, discount_value: 0, discount_percent: 0, freight: 0, total: 0,
  };
  const [newItem, setNewItem] = useState<OrderItem>({ ...emptyItem });

  // Insumo search
  const [insumoSearch, setInsumoSearch] = useState("");
  const [insumoDropdownOpen, setInsumoDropdownOpen] = useState(false);
  const insumoRef = useRef<HTMLDivElement>(null);

  const { data: companiesList = [] } = useCompanies();
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list_po_modal"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("active", true).order("name");
      return data || [];
    },
  });
  const { data: obras = [] } = useQuery({
    queryKey: ["obras_list_po_modal"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, name").eq("active", true).order("name");
      return data || [];
    },
  });
  const { data: insumos = [] } = useQuery({
    queryKey: ["insumos_po"],
    queryFn: async () => {
      const { data } = await supabase.from("insumos").select("id, name, unit, category").order("name");
      return (data || []) as Insumo[];
    },
  });

  // Vendor contacts for selected supplier
  const { data: vendorContacts = [] } = useQuery({
    queryKey: ["vendor_contacts_po", form.supplier_id],
    queryFn: async () => {
      if (!form.supplier_id) return [];
      const { data } = await supabase.from("supplier_contacts").select("id, name").eq("supplier_id", form.supplier_id).order("name");
      return data || [];
    },
    enabled: !!form.supplier_id,
  });

  const filteredInsumos = insumos.filter(i =>
    i.name.toLowerCase().includes(insumoSearch.toLowerCase())
  ).slice(0, 20);

  // Load data when editing
  useEffect(() => {
    if (open) {
      setActiveTab("dados");
      if (editing) {
        setForm({ ...editing });
        loadItems(editing.id);
      } else {
        setForm({ status: "rascunho", order_date: new Date().toISOString().slice(0, 10) });
        setOrderItems([]);
      }
      resetNewItem();
    }
  }, [open, editing]);

  const loadItems = async (orderId: string) => {
    const { data } = await (supabase as any).from("purchase_order_items").select("*").eq("purchase_order_id", orderId).order("sort_order");
    setOrderItems((data || []).map((r: any) => ({
      id: r.id, item_type: r.item_type, insumo_id: r.insumo_id,
      description: r.description, brand: r.brand || "", complement: r.complement || "",
      obra_id: r.obra_id || "", phase: r.phase || "", service: r.service || "",
      quantity: r.quantity, unit: r.unit, unit_price: r.unit_price,
      discount_value: r.discount_value || 0, discount_percent: r.discount_percent || 0,
      freight: r.freight || 0, total: r.total || 0,
    })));
  };

  const resetNewItem = () => {
    setNewItem({ ...emptyItem });
    setInsumoSearch("");
    setInsumoDropdownOpen(false);
    setEditingItemIdx(null);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (insumoRef.current && !insumoRef.current.contains(e.target as Node)) setInsumoDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Totals
  const itemsSubtotal = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const itemsTotal = orderItems.reduce((s, i) => s + calcItemTotal(i), 0);
  const globalDiscount = Number(form.discount_value) || 0;
  const globalDiscountPct = Number(form.discount_percent) || 0;
  const globalFreight = Number(form.freight) || 0;
  const finalDiscount = globalDiscountPct > 0 ? itemsTotal * (globalDiscountPct / 100) : globalDiscount;
  const grandTotal = Math.max(0, itemsTotal - finalDiscount + globalFreight);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const orderData = {
        supplier_id: form.supplier_id,
        company_id: form.company_id || null,
        obra_id: form.obra_id || null,
        order_code: form.order_code || null,
        description: form.description || null,
        status: form.status || "rascunho",
        order_date: form.order_date || null,
        delivery_date: form.delivery_date || null,
        payment_terms: form.payment_terms || null,
        notes: form.notes || null,
        discount_value: globalDiscount,
        discount_percent: globalDiscountPct,
        freight: globalFreight,
        subtotal: itemsSubtotal,
        total_value: grandTotal,
      };

      let orderId: string;
      if (editing) {
        const { error } = await (supabase as any).from("purchase_orders").update(orderData).eq("id", editing.id);
        if (error) throw error;
        orderId = editing.id;
        // Delete old items
        await (supabase as any).from("purchase_order_items").delete().eq("purchase_order_id", orderId);
      } else {
        const { data, error } = await (supabase as any).from("purchase_orders").insert({ ...orderData, user_id: user!.id }).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      // Insert items
      if (orderItems.length > 0) {
        const rows = orderItems.map((item, idx) => ({
          purchase_order_id: orderId,
          item_type: item.item_type,
          insumo_id: item.insumo_id || null,
          description: item.description,
          brand: item.brand || null,
          complement: item.complement || null,
          obra_id: item.obra_id || null,
          phase: item.phase || null,
          service: item.service || null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          discount_value: item.discount_value || 0,
          discount_percent: item.discount_percent || 0,
          freight: item.freight || 0,
          total: calcItemTotal(item),
          sort_order: idx,
        }));
        const { error } = await (supabase as any).from("purchase_order_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success(editing ? "Ordem atualizada!" : "Ordem criada!");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.supplier_id) { toast.error("Selecione um fornecedor"); return; }
    saveMutation.mutate();
  };

  const selectInsumo = (insumo: Insumo) => {
    setNewItem(p => ({ ...p, insumo_id: insumo.id, description: insumo.name, unit: insumo.unit }));
    setInsumoSearch(insumo.name);
    setInsumoDropdownOpen(false);
  };

  const addItem = () => {
    if (!newItem.description.trim()) { toast.error("Insumo/Descrição é obrigatório"); return; }
    if (newItem.quantity <= 0) { toast.error("Quantidade inválida"); return; }
    const item = { ...newItem, total: calcItemTotal(newItem) };
    if (editingItemIdx !== null) {
      setOrderItems(prev => prev.map((it, i) => i === editingItemIdx ? item : it));
    } else {
      setOrderItems(prev => [...prev, item]);
    }
    resetNewItem();
  };

  const editItem = (idx: number) => {
    const item = orderItems[idx];
    setNewItem({ ...item });
    setInsumoSearch(item.description);
    setEditingItemIdx(idx);
  };

  const removeItem = (idx: number) => setOrderItems(prev => prev.filter((_, i) => i !== idx));

  // Update newItem total when values change
  const updatedNewItem = { ...newItem, total: calcItemTotal(newItem) };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-5xl flex flex-col" style={{ height: "85vh" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
          <h3 className="text-lg font-semibold text-primary">{editing ? "Editar" : "Nova"} Ordem de Compra</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/30">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "dados" && (
            <div className="p-6 space-y-4">
              {/* Info header */}
              {editing && (
                <div className="flex items-center gap-8 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2">
                  <span>Compra: {editing.order_code || "—"}</span>
                  <span>Situação: {STATUS_OPTIONS.find(s => s.value === editing.status)?.label || "—"}</span>
                  <span>Dt. Criação: {editing.created_at ? new Date(editing.created_at).toLocaleDateString("pt-BR") : "—"}</span>
                </div>
              )}

              {/* Empresa + Descrição */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Empresa *</label>
                  <select value={form.company_id || ""} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {companiesList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_type === "filial" ? "↳ " : ""}{c.name}{c.company_type === "matriz" ? " (Matriz)" : " (Filial)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                  <input value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {/* Fornecedor + Vendedor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Fornecedor *</label>
                  <select value={form.supplier_id || ""} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value, vendor_contact_id: "" }))} required className={inputClass}>
                    <option value="">Selecione...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Vendedor</label>
                  <select value={form.vendor_contact_id || ""} onChange={e => setForm(p => ({ ...p, vendor_contact_id: e.target.value }))} className={inputClass} disabled={!form.supplier_id}>
                    <option value="">Selecione...</option>
                    {vendorContacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Status + Código + Datas */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Código OC</label>
                  <input value={form.order_code || ""} onChange={e => setForm(p => ({ ...p, order_code: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select value={form.status || "rascunho"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Data da OC</label>
                  <input type="date" value={form.order_date || ""} onChange={e => setForm(p => ({ ...p, order_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Previsão entrega</label>
                  <input type="date" value={form.delivery_date || ""} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {/* ===== ADICIONAR ITEM ===== */}
              <fieldset className="border border-border rounded-lg p-4 space-y-3">
                <legend className="text-sm font-semibold text-primary px-2">Adicionar item</legend>

                <div className="flex items-center gap-4">
                  {[{ value: "insumo", label: "Insumo" }, { value: "servico", label: "Serviço" }].map(t => (
                    <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="po_item_type" value={t.value}
                        checked={newItem.item_type === t.value}
                        onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}
                        className="accent-primary" />
                      {t.label}
                    </label>
                  ))}
                </div>

                {/* Obra + Fase + Serviço */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Obra</label>
                    <select value={newItem.obra_id} onChange={e => setNewItem(p => ({ ...p, obra_id: e.target.value }))} className={inputClass}>
                      <option value="">Selecione...</option>
                      {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Fase</label>
                    <input value={newItem.phase} onChange={e => setNewItem(p => ({ ...p, phase: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Serviço</label>
                    <input value={newItem.service} onChange={e => setNewItem(p => ({ ...p, service: e.target.value }))} className={inputClass} />
                  </div>
                </div>

                {/* Insumo + Marca + Complemento */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative" ref={insumoRef}>
                    <label className="block text-sm font-medium text-foreground mb-1">Insumo *</label>
                    <div className="relative">
                      <input
                        value={insumoSearch}
                        onChange={e => { setInsumoSearch(e.target.value); setInsumoDropdownOpen(true); setNewItem(p => ({ ...p, insumo_id: undefined, description: e.target.value })); }}
                        onFocus={() => setInsumoDropdownOpen(true)}
                        placeholder="Procure insumos..."
                        className={inputClass}
                      />
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {insumoDropdownOpen && filteredInsumos.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                        {filteredInsumos.map(ins => (
                          <button key={ins.id} type="button" onClick={() => selectInsumo(ins)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex justify-between">
                            <span className="text-foreground">{ins.name}</span>
                            <span className="text-muted-foreground text-xs">{ins.category} • {ins.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Marca</label>
                    <input value={newItem.brand} onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
                    <input value={newItem.complement} onChange={e => setNewItem(p => ({ ...p, complement: e.target.value }))} className={inputClass} />
                  </div>
                </div>

                {/* Qtd + Un + Vlr unitário + Subtotal */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Qtd. *</label>
                    <div className="flex gap-2">
                      <input type="number" step="0.01" min="0.01" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))} className={inputClass} />
                      <input value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} className={`${inputClass} w-20`} placeholder="un" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Vlr. unitário *</label>
                    <input type="number" step="0.01" value={newItem.unit_price} onChange={e => setNewItem(p => ({ ...p, unit_price: Number(e.target.value) }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Subtotal</label>
                    <input readOnly value={(newItem.quantity * newItem.unit_price).toFixed(2)} className={`${inputClass} bg-muted`} />
                  </div>
                  <div />
                </div>

                {/* Desc + Frete + Total + Buttons */}
                <div className="grid grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Desc.</label>
                    <div className="flex gap-1">
                      <input type="number" step="0.01" value={newItem.discount_value} onChange={e => setNewItem(p => ({ ...p, discount_value: Number(e.target.value), discount_percent: 0 }))} className={inputClass} placeholder="R$" />
                      <input type="number" step="0.01" value={newItem.discount_percent} onChange={e => setNewItem(p => ({ ...p, discount_percent: Number(e.target.value), discount_value: 0 }))} className={`${inputClass} w-20`} placeholder="%" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Frete</label>
                    <input type="number" step="0.01" value={newItem.freight} onChange={e => setNewItem(p => ({ ...p, freight: Number(e.target.value) }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Total</label>
                    <input readOnly value={updatedNewItem.total.toFixed(2)} className={`${inputClass} bg-muted font-medium`} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    {editingItemIdx !== null && (
                      <button type="button" onClick={resetNewItem} className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={addItem} className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90" title={editingItemIdx !== null ? "Atualizar" : "Adicionar"}>
                      {editingItemIdx !== null ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </fieldset>

              {/* Items list */}
              <fieldset className="border border-border rounded-lg p-4">
                <legend className="text-sm font-semibold text-muted-foreground px-2">Relação de itens [{orderItems.length}]</legend>
                {orderItems.length === 0 ? (
                  <p className="text-sm text-destructive py-2">Nenhum registro.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-2 py-2 font-medium text-muted-foreground">Insumo</th>
                          <th className="text-left px-2 py-2 font-medium text-muted-foreground">Marca</th>
                          <th className="text-center px-2 py-2 font-medium text-muted-foreground">Qtd</th>
                          <th className="text-center px-2 py-2 font-medium text-muted-foreground">Un</th>
                          <th className="text-right px-2 py-2 font-medium text-muted-foreground">Unitário</th>
                          <th className="text-right px-2 py-2 font-medium text-muted-foreground">Total</th>
                          <th className="w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((it, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/20">
                            <td className="px-2 py-2 text-foreground">{it.description}</td>
                            <td className="px-2 py-2 text-muted-foreground">{it.brand || "—"}</td>
                            <td className="px-2 py-2 text-center">{it.quantity}</td>
                            <td className="px-2 py-2 text-center text-muted-foreground">{it.unit}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(it.unit_price)}</td>
                            <td className="px-2 py-2 text-right font-medium">{formatCurrency(calcItemTotal(it))}</td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1 justify-center">
                                <button type="button" onClick={() => editItem(idx)} className="p-1 rounded hover:bg-accent text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {activeTab === "pagamento" && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Condições de pagamento</label>
                <input value={form.payment_terms || ""} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
                <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={4} className={inputClass} />
              </div>
            </div>
          )}

          {activeTab === "anexos" && editing && (
            <div className="p-6">
              <Attachments entityType="purchase_order" entityId={editing.id} />
            </div>
          )}
          {activeTab === "anexos" && !editing && (
            <div className="p-6 text-sm text-muted-foreground">Salve a ordem primeiro para anexar arquivos.</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted rounded-b-xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <span>Subtotal: <strong>{formatCurrency(itemsSubtotal)}</strong></span>
              <div className="flex items-center gap-1">
                <span>Desconto</span>
                <input type="number" step="0.01" value={form.discount_value || 0} onChange={e => setForm(p => ({ ...p, discount_value: Number(e.target.value), discount_percent: 0 }))} className="w-20 px-2 py-1 rounded border border-input bg-background text-sm" placeholder="R$" />
                <input type="number" step="0.01" value={form.discount_percent || 0} onChange={e => setForm(p => ({ ...p, discount_percent: Number(e.target.value), discount_value: 0 }))} className="w-16 px-2 py-1 rounded border border-input bg-background text-sm" placeholder="%" />
              </div>
              <div className="flex items-center gap-1">
                <span>Frete</span>
                <input type="number" step="0.01" value={form.freight || 0} onChange={e => setForm(p => ({ ...p, freight: Number(e.target.value) }))} className="w-24 px-2 py-1 rounded border border-input bg-background text-sm" />
              </div>
              <span>Total: <strong className="text-primary">{formatCurrency(grandTotal)}</strong></span>
            </div>
            <button type="button" onClick={handleSave} disabled={saveMutation.isPending} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
              {saveMutation.isPending ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
