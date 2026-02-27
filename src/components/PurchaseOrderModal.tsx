import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Search, Plus, Trash2, Pencil, Paperclip, History } from "lucide-react";
import { fetchCep } from "@/utils/cep";
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
  { key: "enderecos", label: "Endereços" },
  { key: "pagamento", label: "Pagamento" },
  { key: "recebimento", label: "Recebimento" },
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

  // Recebimento state
  const [receivings, setReceivings] = useState<Record<string, number>>({});
  const [receivedTotals, setReceivedTotals] = useState<Record<string, number>>({});
  const [recFilterObra, setRecFilterObra] = useState("");
  const [recFilterPhase, setRecFilterPhase] = useState("");
  const [recFilterService, setRecFilterService] = useState("");
  const [recFilterInsumos, setRecFilterInsumos] = useState("todos");
  const [recFilterLancamento, setRecFilterLancamento] = useState("total");
  const [recSelectedItems, setRecSelectedItems] = useState<Set<string>>(new Set());
  const [lancamentoModalOpen, setLancamentoModalOpen] = useState(false);
  const [lancamentoRomaneio, setLancamentoRomaneio] = useState("");
  const [lancamentoNotes, setLancamentoNotes] = useState("");
  const [lancamentoDate, setLancamentoDate] = useState(new Date().toISOString().slice(0, 10));
  const [lancamentoRecebedor, setLancamentoRecebedor] = useState("");
  const [attachmentItemId, setAttachmentItemId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<OrderItem | null>(null);

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
    queryKey: ["obras_list_po_modal", form.company_id],
    queryFn: async () => {
      let q = supabase.from("obras").select("id, name, company_id").eq("active", true).order("name");
      if (form.company_id) q = q.eq("company_id", form.company_id);
      const { data } = await q;
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

  // Fetch budget items for selected obra (item-level)
  const selectedItemObraId = newItem.obra_id;
  const { data: obraBudgetItems = [] } = useQuery({
    queryKey: ["obra_budget_items_po", selectedItemObraId],
    enabled: !!selectedItemObraId,
    queryFn: async () => {
      // Find budgets for this obra
      const { data: budgets } = await supabase.from("budgets").select("id").eq("obra_id", selectedItemObraId!);
      if (!budgets || budgets.length === 0) return [];
      const budgetIds = budgets.map(b => b.id);
      const { data: items } = await supabase.from("budget_items").select("description, category").in("budget_id", budgetIds).order("sort_order");
      return items || [];
    },
  });

  // Extract phases (category contains "Fase" or similar root items like "1 Fundação")
  const budgetPhases = obraBudgetItems
    .filter(i => {
      const cat = (i.category || "").toLowerCase();
      const desc = i.description || "";
      // Root phases: items whose description starts with a single number (no dot)
      const prefix = desc.match(/^(\d+)/)?.[1];
      return cat === "fase" || (prefix && !desc.match(/^\d+\.\d+/));
    })
    .map(i => i.description)
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  // Extract services filtered by selected phase
  const budgetServices = obraBudgetItems
    .filter(i => {
      if (!newItem.phase) return false;
      const desc = i.description || "";
      const phasePrefix = newItem.phase.match(/^(\d+)/)?.[1];
      // Services are sub-items like "1.1 Something"
      return phasePrefix && desc.match(new RegExp(`^${phasePrefix}\\.\\d+`));
    })
    .map(i => i.description)
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx);

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
        loadReceivings(editing.id);
      } else {
        setForm({ status: "rascunho", order_date: new Date().toISOString().slice(0, 10) });
        setOrderItems([]);
        setReceivedTotals({});
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

  const loadReceivings = async (orderId: string) => {
    const { data } = await (supabase as any).from("purchase_order_receivings").select("purchase_order_item_id, quantity").eq("purchase_order_id", orderId);
    const totals: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      totals[r.purchase_order_item_id] = (totals[r.purchase_order_item_id] || 0) + Number(r.quantity);
    });
    setReceivedTotals(totals);
  };

  const openLancamentoModal = () => {
    const selectedItemIds = Array.from(recSelectedItems);
    if (selectedItemIds.length === 0) { toast.error("Selecione ao menos um item"); return; }
    const hasQty = selectedItemIds.some(id => (receivings[id] || 0) > 0);
    if (!hasQty) { toast.error("Informe a quantidade para lançamento"); return; }
    setLancamentoDate(new Date().toISOString().slice(0, 10));
    setLancamentoRomaneio("");
    setLancamentoNotes("");
    setLancamentoRecebedor(form.delivery_receiver || "");
    setLancamentoModalOpen(true);
  };

  const handleLancamento = async () => {
    if (!editing) return;
    const selectedItemIds = Array.from(recSelectedItems);
    const rows = selectedItemIds
      .filter(itemId => (receivings[itemId] || 0) > 0)
      .map(itemId => ({
        purchase_order_id: editing.id,
        purchase_order_item_id: itemId,
        quantity: receivings[itemId],
        user_id: user!.id,
        romaneio: lancamentoRomaneio || null,
        notes: lancamentoNotes || null,
        delivery_date: lancamentoDate || null,
        receiver: lancamentoRecebedor || null,
      }));
    if (rows.length === 0) return;
    const { error } = await (supabase as any).from("purchase_order_receivings").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento de entrega realizado!");
    setReceivings({});
    setRecSelectedItems(new Set());
    setLancamentoModalOpen(false);
    loadReceivings(editing.id);
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
        delivery_address_source: form.delivery_address_source || "obra",
        delivery_cep: form.delivery_cep || null,
        delivery_address: form.delivery_address || null,
        delivery_number: form.delivery_number || null,
        delivery_complement: form.delivery_complement || null,
        delivery_neighborhood: form.delivery_neighborhood || null,
        delivery_state: form.delivery_state || null,
        delivery_city: form.delivery_city || null,
        delivery_receiver: form.delivery_receiver || null,
        billing_address_source: form.billing_address_source || "obra",
        billing_cep: form.billing_cep || null,
        billing_address: form.billing_address || null,
        billing_number: form.billing_number || null,
        billing_complement: form.billing_complement || null,
        billing_neighborhood: form.billing_neighborhood || null,
        billing_state: form.billing_state || null,
        billing_city: form.billing_city || null,
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

        // Auto-generate financial doc (despesa) for new orders
        const supplierName = suppliers.find((s: any) => s.id === form.supplier_id)?.name || "";
        const financialPayload = {
          user_id: user!.id,
          description: `OC ${form.order_code || orderId.slice(0, 8)} - ${supplierName}`.trim(),
          type: "despesa",
          value: grandTotal,
          status: "pendente",
          due_date: form.delivery_date || null,
          category: "Ordem de Compra",
          obra_id: form.obra_id || null,
          supplier_id: form.supplier_id || null,
          company_id: form.company_id || null,
          notes: `Gerado automaticamente pela Ordem de Compra ${form.order_code || ""}`.trim(),
        };
        await supabase.from("financial_docs").insert(financialPayload);
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
      qc.invalidateQueries({ queryKey: ["financial_docs"] });
      toast.success(editing ? "Ordem atualizada!" : "Ordem criada! Cobrança gerada no financeiro.");
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
                  <select value={form.company_id || ""} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, obra_id: "" }))} className={inputClass}>
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
                    {budgetPhases.length > 0 ? (
                      <select value={newItem.phase} onChange={e => setNewItem(p => ({ ...p, phase: e.target.value, service: "" }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {budgetPhases.map(ph => <option key={ph} value={ph}>{ph}</option>)}
                      </select>
                    ) : (
                      <input value={newItem.phase} onChange={e => setNewItem(p => ({ ...p, phase: e.target.value }))} className={inputClass} placeholder={newItem.obra_id ? "Nenhuma fase no orçamento" : "Selecione uma obra"} />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Serviço</label>
                    {budgetServices.length > 0 ? (
                      <select value={newItem.service} onChange={e => setNewItem(p => ({ ...p, service: e.target.value }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {budgetServices.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                      </select>
                    ) : (
                      <input value={newItem.service} onChange={e => setNewItem(p => ({ ...p, service: e.target.value }))} className={inputClass} placeholder={newItem.phase ? "Nenhum serviço nesta fase" : "Selecione uma fase"} />
                    )}
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

          {activeTab === "enderecos" && (
            <div className="p-6 space-y-6">
              {/* Endereço de entrega */}
              <AddressSection
                title="Endereço entrega"
                prefix="delivery"
                form={form}
                setForm={setForm}
                obras={obras}
                extraField={
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Recebedor</label>
                    <input value={form.delivery_receiver || ""} onChange={e => setForm(p => ({ ...p, delivery_receiver: e.target.value }))} className={inputClass} />
                  </div>
                }
              />

              {/* Endereço de cobrança */}
              <AddressSection
                title="Endereço cobrança"
                prefix="billing"
                form={form}
                setForm={setForm}
                obras={obras}
              />
            </div>
          )}

          {activeTab === "pagamento" && (
            <div className="p-6 flex gap-6">
              {/* Resumo sidebar */}
              <div className="w-64 flex-shrink-0 border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-semibold text-foreground text-center border-b border-border">Resumo</div>
                <div className="divide-y divide-border text-sm">
                  {[
                    ["Qtd. itens", String(orderItems.length)],
                    ["Total itens", formatCurrency(itemsTotal)],
                    ["Desconto", formatCurrency(finalDiscount)],
                    ["Frete", formatCurrency(globalFreight)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-medium">{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2 bg-muted/50">
                    <span className="font-semibold text-foreground">TOTAL</span>
                    <span className="font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment form */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right">Faturamento para *</label>
                  <div className="flex gap-4">
                    {[{ value: "empresa", label: "Empresa" }, { value: "cliente", label: "Cliente" }].map(o => (
                      <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="billing_target" value={o.value} checked={(form.billing_target || "empresa") === o.value} onChange={e => setForm(p => ({ ...p, billing_target: e.target.value }))} className="accent-primary" />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right">Lançamento financeiro</label>
                  <div className="flex gap-4">
                    {[{ value: "no_recebimento", label: "No recebimento" }, { value: "antes_recebimento", label: "Antes do recebimento" }].map(o => (
                      <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="financial_posting" value={o.value} checked={(form.financial_posting || "no_recebimento") === o.value} onChange={e => setForm(p => ({ ...p, financial_posting: e.target.value }))} className="accent-primary" />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right">Condição pagamento *</label>
                  <select value={form.payment_terms || ""} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className={`${inputClass} max-w-xs`}>
                    <option value="">Selecione...</option>
                    <option value="a_vista">À vista</option>
                    <option value="7_dias">7 dias [1 parcela]</option>
                    <option value="14_dias">14 dias [1 parcela]</option>
                    <option value="21_dias">21 dias [1 parcela]</option>
                    <option value="28_dias">28 dias [1 parcela]</option>
                    <option value="30_dias">30 dias [1 parcela]</option>
                    <option value="30_60_dias">30/60 dias [2 parcelas]</option>
                    <option value="30_60_90_dias">30/60/90 dias [3 parcelas]</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right">Forma de pagamento</label>
                  <select value={form.payment_method || ""} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className={`${inputClass} max-w-xs`}>
                    <option value="">Selecione...</option>
                    <option value="boleto">Boleto</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao">Cartão</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right">Previsão entrega *</label>
                  <input type="date" value={form.delivery_date || ""} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} className={`${inputClass} max-w-[180px]`} />
                </div>

                <div className="flex items-start gap-3">
                  <label className="text-sm font-medium text-foreground w-44 text-right pt-2">Observação</label>
                  <div className="flex-1">
                    <textarea value={form.notes || ""} onChange={e => { if (e.target.value.length <= 4000) setForm(p => ({ ...p, notes: e.target.value })); }} rows={6} className={inputClass} />
                    <p className="text-xs text-muted-foreground text-right mt-1">{4000 - (form.notes?.length || 0)} caracteres restantes</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "recebimento" && editing && (() => {
            const recItems = orderItems.filter(it => {
              if (!it.id) return false;
              if (recFilterObra && it.obra_id !== recFilterObra) return false;
              if (recFilterPhase && it.phase !== recFilterPhase) return false;
              if (recFilterService && it.service !== recFilterService) return false;
              const received = receivedTotals[it.id!] || 0;
              if (recFilterInsumos === "lancados" && received === 0) return false;
              if (recFilterInsumos === "nao_lancados" && received > 0) return false;
              return true;
            });
            const recItemsTotal = recItems.reduce((s, i) => s + calcItemTotal(i), 0);
            const recItemsFreight = recItems.reduce((s, i) => s + (i.freight || 0), 0);
            const selectedItems = recItems.filter(it => recSelectedItems.has(it.id!));
            const selectedTotal = selectedItems.reduce((s, i) => {
              const qty = receivings[i.id!] || 0;
              return s + (qty * i.unit_price);
            }, 0);
            const selectedFreight = selectedItems.reduce((s, i) => s + (i.freight || 0), 0);
            const totalReceived = orderItems.reduce((s, i) => s + (receivedTotals[i.id!] || 0), 0);
            const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0);
            const overallPct = totalQty > 0 ? (totalReceived / totalQty) * 100 : 0;
            const itemObras = [...new Set(orderItems.filter(i => i.obra_id).map(i => i.obra_id))];
            const itemPhases = [...new Set(orderItems.filter(i => i.phase).map(i => i.phase))];
            const itemServices = [...new Set(orderItems.filter(i => i.service).map(i => i.service))];

            return (
              <div className="flex flex-col h-full">
                {/* Filters row */}
                <div className="px-5 pt-4 pb-3 border-b border-border bg-muted/20">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="min-w-[130px]">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Obra</label>
                      <select value={recFilterObra} onChange={e => setRecFilterObra(e.target.value)} className={`${inputClass} !py-1.5 !text-xs`}>
                        <option value="">Selecione...</option>
                        {itemObras.map(id => {
                          const o = obras.find((ob: any) => ob.id === id);
                          return <option key={id} value={id}>{o?.name || id}</option>;
                        })}
                      </select>
                    </div>
                    <div className="min-w-[130px]">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fase</label>
                      <select value={recFilterPhase} onChange={e => setRecFilterPhase(e.target.value)} className={`${inputClass} !py-1.5 !text-xs`}>
                        <option value="">Selecione...</option>
                        {itemPhases.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[130px]">
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Serviço</label>
                      <select value={recFilterService} onChange={e => setRecFilterService(e.target.value)} className={`${inputClass} !py-1.5 !text-xs`}>
                        <option value="">Selecione...</option>
                        {itemServices.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="border-l border-border pl-3 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Insumos</span>
                      <div className="flex items-center gap-3">
                        {[{ v: "todos", l: "Todos" }, { v: "nao_lancados", l: "Não Lançados" }, { v: "lancados", l: "Lançados" }].map(o => (
                          <label key={o.v} className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                            <input type="radio" name="rec_insumos" value={o.v} checked={recFilterInsumos === o.v} onChange={() => setRecFilterInsumos(o.v)} className="accent-primary w-3.5 h-3.5" />
                            {o.l}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="border-l border-border pl-3 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Lançamento</span>
                      <div className="flex items-center gap-3">
                        {[{ v: "total", l: "Total (todos os itens)" }, { v: "parcial", l: "Parcial" }].map(o => (
                          <label key={o.v} className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                            <input type="radio" name="rec_lancamento" value={o.v} checked={recFilterLancamento === o.v} onChange={() => {
                              setRecFilterLancamento(o.v);
                              if (o.v === "total") {
                                setRecSelectedItems(new Set(recItems.map(i => i.id!)));
                                const newRec: Record<string, number> = {};
                                recItems.forEach(i => { newRec[i.id!] = Math.max(0, i.quantity - (receivedTotals[i.id!] || 0)); });
                                setReceivings(newRec);
                              } else {
                                setRecSelectedItems(new Set());
                                setReceivings({});
                              }
                            }} className="accent-primary w-3.5 h-3.5" />
                            {o.l}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-primary font-medium mt-2">Insumos para lançamento/recebimento</p>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  {recItems.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-primary/90 text-primary-foreground">
                          <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                          <th className="text-left px-3 py-2.5 font-semibold">Fase/Serviço</th>
                          <th className="text-left px-3 py-2.5 font-semibold">Obra</th>
                          <th className="text-right px-3 py-2.5 font-semibold">Qtd.</th>
                          <th className="text-center px-3 py-2.5 font-semibold">Unid.</th>
                          <th className="text-right px-3 py-2.5 font-semibold">Total (R$)</th>
                          <th className="text-center px-3 py-2.5 font-semibold min-w-[150px]">Lançados/Recebidos</th>
                          <th className="text-center px-3 py-2.5 font-semibold min-w-[140px]">Qtd. Lançamento</th>
                          <th className="text-center px-3 py-2.5 font-semibold w-14">Anexo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recItems.map((it, idx) => {
                          const itemId = it.id!;
                          const received = receivedTotals[itemId] || 0;
                          const pct = it.quantity > 0 ? (received / it.quantity) * 100 : 0;
                          const remaining = Math.max(0, it.quantity - received);
                          const isSelected = recSelectedItems.has(itemId);
                          const obraName = obras.find((o: any) => o.id === it.obra_id)?.name || "";
                          const phaseService = [it.phase, it.service].filter(Boolean).join(" | ");
                          return (
                            <tr key={itemId} className={`border-b border-border ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40 transition-colors cursor-pointer`} onClick={() => setHistoryItem(it)}>
                              <td className="px-3 py-2.5 text-foreground font-medium max-w-[180px] truncate" title={`${it.description} — Clique para ver histórico`}>
                                <span className="hover:underline text-primary">{it.description}</span>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={phaseService}>{phaseService || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate" title={obraName}>{obraName || "—"}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{it.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2.5 text-center text-muted-foreground">{it.unit}</td>
                              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatCurrency(calcItemTotal(it))}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs tabular-nums w-14 text-right">{received.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                  <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden border border-border">
                                    <div
                                      className="h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${Math.min(pct, 100)}%`,
                                        background: pct >= 100
                                          ? "hsl(var(--primary))"
                                          : "linear-gradient(90deg, hsl(142 71% 45%), hsl(80 60% 50%))",
                                      }}
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct.toFixed(2)}%</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => {
                                      const next = new Set(recSelectedItems);
                                      if (e.target.checked) { next.add(itemId); setReceivings(p => ({ ...p, [itemId]: remaining })); }
                                      else { next.delete(itemId); setReceivings(p => { const n = { ...p }; delete n[itemId]; return n; }); }
                                      setRecSelectedItems(next);
                                    }}
                                    className="accent-primary w-4 h-4 cursor-pointer"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={remaining}
                                    value={receivings[itemId] ?? ""}
                                    onChange={e => setReceivings(p => ({ ...p, [itemId]: Number(e.target.value) }))}
                                    disabled={!isSelected}
                                    className="w-24 px-2 py-1.5 rounded-lg border border-input bg-background text-xs text-right tabular-nums disabled:opacity-40 focus:ring-2 focus:ring-ring focus:outline-none"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAttachmentItemId(itemId); }}
                                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                                  title="Anexos"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer summary */}
                <div className="border-t border-border bg-muted/30 px-5 py-3 space-y-2">
                  {/* Row 1: All items */}
                  <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-x-3 gap-y-0 text-xs">
                    <span className="text-muted-foreground font-medium">Itens</span>
                    <span className="font-semibold text-foreground">{recItems.length} item(ns)</span>
                    <span className="text-muted-foreground font-medium">Subtotal</span>
                    <span className="font-semibold text-foreground">{formatCurrency(recItemsTotal)}</span>
                    <span className="text-muted-foreground font-medium">Frete ({recItems.length > 0 ? `${recItems.length} obra(s)` : "0"})</span>
                    <span className="font-semibold text-foreground">{formatCurrency(recItemsFreight)}</span>
                    <span className="text-muted-foreground font-medium">Total</span>
                    <span className="font-bold text-foreground">{formatCurrency(recItemsTotal)}</span>
                  </div>

                  {/* Row 2: Selected items */}
                  {selectedItems.length > 0 && (
                    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-x-3 gap-y-0 text-xs text-primary">
                      <span className="font-medium">Itens selecionados p/ lançamento</span>
                      <span className="font-semibold">{selectedItems.length} item(ns)</span>
                      <span className="font-medium">Subtotal</span>
                      <span className="font-semibold">{formatCurrency(selectedTotal)}</span>
                      <span className="font-medium">Frete</span>
                      <span className="font-semibold">{formatCurrency(selectedFreight)}</span>
                      <span className="font-medium">Total</span>
                      <span className="font-bold">{formatCurrency(selectedTotal + selectedFreight)}</span>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Lançados/Recebidos</span>
                    <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(overallPct, 100)}%`,
                          background: overallPct >= 100
                            ? "hsl(var(--primary))"
                            : "linear-gradient(90deg, hsl(142 71% 45%), hsl(80 60% 50%))",
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">{overallPct.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={openLancamentoModal}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 text-sm shadow-sm transition-all"
                    >
                      Gerar Lançamento
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "recebimento" && !editing && (
            <div className="p-6 text-sm text-muted-foreground">Salve a ordem primeiro para gerenciar recebimentos.</div>
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

      {/* Attachment overlay for recebimento items */}
      {attachmentItemId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setAttachmentItemId(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted rounded-t-xl">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos do Item</h3>
              <button onClick={() => setAttachmentItemId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4">
              <Attachments entityType="po_item" entityId={attachmentItemId} />
            </div>
          </div>
        </div>
      )}

      {/* History modal for item receivings */}
      {historyItem && editing && <ItemReceivingHistory
        item={historyItem}
        orderId={editing.id}
        deliveryReceiver={form.delivery_receiver || ""}
        onClose={() => setHistoryItem(null)}
      />}

      {/* Lancamento Modal */}
      {lancamentoModalOpen && (() => {
        const selIds = Array.from(recSelectedItems).filter(id => (receivings[id] || 0) > 0);
        const selItems = orderItems.filter(it => it.id && selIds.includes(it.id));
        const totalBruto = selItems.reduce((s, it) => s + (receivings[it.id!] || 0) * it.unit_price, 0);
        const totalFrete = selItems.reduce((s, it) => s + (it.freight || 0), 0);
        const totalPagar = totalBruto + totalFrete;
        const supplierName = suppliers.find((s: any) => s.id === form.supplier_id)?.name || "—";
        const obraName = obras.find((o: any) => o.id === form.obra_id)?.name || "—";
        const companyName = companiesList.find((c: any) => c.id === form.company_id)?.name || "—";

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setLancamentoModalOpen(false)}>
            <div className="bg-card border border-border rounded-xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
                <h3 className="text-lg font-semibold text-primary">Novo documento a pagar</h3>
                <button onClick={() => setLancamentoModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Row: Empresa */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Empresa</label>
                  <span className="text-sm text-foreground font-medium truncate">{companyName}</span>
                </div>

                {/* Row: Tipo */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Tipo</label>
                  <div className="flex gap-4">
                    {[{ v: "provisao", l: "Provisão" }, { v: "previsao", l: "Previsão" }, { v: "adiantamento", l: "Adiantamento" }].map(o => (
                      <label key={o.v} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                        <input type="radio" name="lancamento_tipo" value={o.v} defaultChecked={o.v === "provisao"} className="accent-primary" />
                        {o.l}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Row: Fornecedor */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Fornecedor</label>
                  <span className="text-sm text-foreground font-medium bg-muted/40 px-3 py-2 rounded-lg border border-input truncate">{supplierName}</span>
                </div>

                {/* Row: Descrição + Obra */}
                <div className="grid grid-cols-[120px_1fr_80px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Descrição</label>
                  <span className="text-sm text-foreground bg-muted/40 px-3 py-2 rounded-lg border border-input truncate">
                    OC {form.order_code || editing?.id?.slice(0, 8) || ""} - {supplierName}
                  </span>
                  <label className="text-sm font-medium text-muted-foreground text-right">Obra *</label>
                  <span className="text-sm text-foreground bg-muted/40 px-3 py-2 rounded-lg border border-input truncate">{obraName}</span>
                </div>

                {/* Row: Recebedor */}
                <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Recebedor</label>
                  <input value={lancamentoRecebedor} onChange={e => setLancamentoRecebedor(e.target.value)} className={inputClass} placeholder="Nome de quem recebeu a entrega..." />
                </div>

                {/* Row: Observação */}
                <div className="grid grid-cols-[120px_1fr] items-start gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right pt-2">Observação</label>
                  <textarea value={lancamentoNotes} onChange={e => setLancamentoNotes(e.target.value)} rows={2} className={inputClass} placeholder="Observações sobre a entrega..." />
                </div>

                <hr className="border-border" />

                {/* Row: Tipo doc + Número */}
                <div className="grid grid-cols-[120px_1fr_80px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Tipo doc. *</label>
                  <select defaultValue="romaneio" className={inputClass}>
                    <option value="romaneio">Romaneio</option>
                    <option value="nota_fiscal">Nota Fiscal</option>
                    <option value="recibo">Recibo</option>
                    <option value="outros">Outros</option>
                  </select>
                  <label className="text-sm font-medium text-muted-foreground text-right">Número</label>
                  <input value={lancamentoRomaneio} onChange={e => setLancamentoRomaneio(e.target.value)} className={inputClass} placeholder="Ex: ROM-001, NF 12345..." />
                </div>

                {/* Row: Valor + Dt. Emissão + Dt. Entrada */}
                <div className="grid grid-cols-[120px_1fr_100px_1fr_100px_1fr] items-center gap-x-3">
                  <label className="text-sm font-medium text-muted-foreground text-right">Valor *</label>
                  <span className="text-sm text-foreground font-semibold bg-muted/40 px-3 py-2 rounded-lg border border-input text-right tabular-nums">{formatCurrency(totalBruto)}</span>
                  <label className="text-sm font-medium text-muted-foreground text-right">Dt. Emissão *</label>
                  <input type="date" value={lancamentoDate} onChange={e => setLancamentoDate(e.target.value)} className={inputClass} />
                  <label className="text-sm font-medium text-muted-foreground text-right">Dt. Entrada *</label>
                  <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
                </div>

                <hr className="border-border" />

                {/* Itens do lançamento */}
                <div className="bg-muted/30 rounded-lg overflow-hidden border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted/50 border-b border-border">Itens do Lançamento</p>
                  <div className="overflow-auto max-h-[200px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-primary/80 text-primary-foreground">
                          <th className="text-left px-3 py-2 font-semibold">Item</th>
                          <th className="text-left px-3 py-2 font-semibold">Orçamento (Fase/Serviço)</th>
                          <th className="text-right px-3 py-2 font-semibold">Qtd.</th>
                          <th className="text-center px-3 py-2 font-semibold">Un.</th>
                          <th className="text-right px-3 py-2 font-semibold">Vlr. Unit.</th>
                          <th className="text-right px-3 py-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selItems.map((it, idx) => {
                          const qty = receivings[it.id!] || 0;
                          const itemTotal = qty * it.unit_price;
                          const budgetRef = [it.phase, it.service].filter(Boolean).join(" | ");
                          return (
                            <tr key={it.id} className={`border-b border-border ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                              <td className="px-3 py-2 text-foreground font-medium truncate max-w-[180px]" title={it.description}>{it.description}</td>
                              <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]" title={budgetRef}>{budgetRef || "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{qty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{it.unit}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(itemTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Anexos do Lançamento */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Anexos (Romaneio, NF, etc.)
                  </p>
                  <div className="p-3">
                    <Attachments entityType="po_receiving" entityId={editing?.id || ""} />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Totals row */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3 border border-border">
                    <span className="text-muted-foreground font-medium">Bruto</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalBruto)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3 border border-border">
                    <span className="text-muted-foreground font-medium">Frete</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalFrete)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-primary/10 rounded-lg px-4 py-3 border border-primary/30">
                    <span className="text-primary font-medium">Valor a pagar</span>
                    <span className="font-bold text-primary tabular-nums">{formatCurrency(totalPagar)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border px-6 py-4 flex justify-end gap-3 bg-muted/30 rounded-b-xl">
                <button type="button" onClick={() => setLancamentoModalOpen(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm">Cancelar</button>
                <button type="button" onClick={handleLancamento} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 text-sm">
                  💾 Salvar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ItemReceivingHistory({
  item, orderId, deliveryReceiver, onClose,
}: {
  item: OrderItem;
  orderId: string;
  deliveryReceiver: string;
  onClose: () => void;
}) {
  const { data: receivingRows = [], isLoading } = useQuery({
    queryKey: ["item_receiving_history", orderId, item.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_order_receivings")
        .select("*")
        .eq("purchase_order_id", orderId)
        .eq("purchase_order_item_id", item.id)
        .order("received_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!item.id,
  });

  // Calculate running remaining
  let runningReceived = 0;
  const rows = receivingRows.map((r: any) => {
    runningReceived += Number(r.quantity);
    return {
      ...r,
      accumulatedReceived: runningReceived,
      remainingAfter: Math.max(0, item.quantity - runningReceived),
    };
  });

  const totalReceived = runningReceived;
  const totalRemaining = Math.max(0, item.quantity - totalReceived);
  const pct = item.quantity > 0 ? (totalReceived / item.quantity) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl flex flex-col" style={{ maxHeight: "80vh" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted rounded-t-xl">
          <div>
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico de Recebimento
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 border-b border-border bg-muted/20">
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs block">Qtd. Total</span>
              <span className="font-semibold text-foreground">{item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {item.unit}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Recebido</span>
              <span className="font-semibold text-foreground">{totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {item.unit}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Restante</span>
              <span className="font-semibold text-foreground">{totalRemaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {item.unit}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Vlr. Unitário</span>
              <span className="font-semibold text-foreground">{formatCurrency(item.unit_price)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Vlr. Recebido</span>
              <span className="font-semibold text-primary">{formatCurrency(totalReceived * item.unit_price)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Progresso</span>
            <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: pct >= 100
                    ? "hsl(var(--primary))"
                    : "linear-gradient(90deg, hsl(142 71% 45%), hsl(80 60% 50%))",
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum lançamento registrado para este item.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-primary/90 text-primary-foreground">
                  <th className="text-center px-3 py-2.5 font-semibold w-10">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Data Entrega</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Data Registro</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Nº Romaneio/Doc</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Recebedor</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Qtd. Baixada</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Acumulado</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Qtd. Restante</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Valor</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, idx: number) => (
                  <tr key={r.id} className={`border-b border-border ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                    <td className="px-3 py-2.5 text-center text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-foreground">
                      {r.delivery_date ? new Date(r.delivery_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {new Date(r.received_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-foreground font-medium">{r.romaneio || "—"}</td>
                    <td className="px-3 py-2.5 text-foreground">{deliveryReceiver || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">
                      {Number(r.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {r.accumulatedReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className={r.remainingAfter === 0 ? "text-green-600 font-semibold" : "text-foreground"}>
                        {r.remainingAfter.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {formatCurrency(Number(r.quantity) * item.unit_price)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[150px] truncate" title={r.notes || ""}>
                      {r.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 bg-muted/30 rounded-b-xl flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function AddressSection({
  title, prefix, form, setForm, obras, extraField,
}: {
  title: string;
  prefix: "delivery" | "billing";
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  obras: any[];
  extraField?: React.ReactNode;
}) {
  const sourceKey = `${prefix}_address_source`;
  const source = form[sourceKey] || "obra";

  const handleSourceChange = (val: string) => {
    setForm(p => ({ ...p, [sourceKey]: val }));
    if (val === "obra") {
      const obraId = form[`${prefix}_obra_ref`] || form.obra_id;
      if (obraId) loadObraAddress(obraId);
    }
  };

  const handleObraChange = (obraId: string) => {
    setForm(p => ({ ...p, [`${prefix}_obra_ref`]: obraId }));
    if (obraId) loadObraAddress(obraId);
  };

  // Auto-load when obra_id changes and source is "obra"
  const currentObraRef = form[`${prefix}_obra_ref`] || form.obra_id;
  const prevObraRef = React.useRef(currentObraRef);
  React.useEffect(() => {
    if (source === "obra" && currentObraRef && currentObraRef !== prevObraRef.current) {
      loadObraAddress(currentObraRef);
    }
    prevObraRef.current = currentObraRef;
  }, [currentObraRef, source]);

  const loadObraAddress = async (obraId: string) => {
    const { data } = await (supabase as any).from("obras").select("cep, address, address_number, complement, neighborhood, state, city").eq("id", obraId).single();
    if (data) {
      setForm(p => ({
        ...p,
        [`${prefix}_cep`]: data.cep || "",
        [`${prefix}_address`]: data.address || "",
        [`${prefix}_number`]: data.address_number || "",
        [`${prefix}_complement`]: data.complement || "",
        [`${prefix}_neighborhood`]: data.neighborhood || "",
        [`${prefix}_state`]: data.state || "",
        [`${prefix}_city`]: data.city || "",
      }));
    }
  };

  const handleCepBlur = async () => {
    const cep = form[`${prefix}_cep`];
    if (!cep || cep.replace(/\D/g, "").length !== 8) return;
    const result = await fetchCep(cep);
    if (result) {
      setForm(p => ({
        ...p,
        [`${prefix}_address`]: result.address,
        [`${prefix}_neighborhood`]: result.neighborhood,
        [`${prefix}_state`]: result.state,
        [`${prefix}_city`]: result.city,
      }));
    }
  };

  const f = (key: string) => form[`${prefix}_${key}`] || "";
  const set = (key: string, val: string) => setForm(p => ({ ...p, [`${prefix}_${key}`]: val }));

  const ic = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

  return (
    <fieldset className="border border-border rounded-lg p-4 space-y-3">
      <legend className="text-sm font-semibold text-muted-foreground px-2">{title}</legend>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">Local *</label>
          <select value={source} onChange={e => handleSourceChange(e.target.value)} className={`${ic} w-28`}>
            <option value="obra">Obra</option>
            <option value="manual">Manual</option>
          </select>
          {source === "obra" && (
            <select value={form[`${prefix}_obra_ref`] || form.obra_id || ""} onChange={e => handleObraChange(e.target.value)} className={ic}>
              <option value="">Selecione...</option>
              {obras.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">CEP *</label>
          <input value={f("cep")} onChange={e => set("cep", e.target.value)} onBlur={handleCepBlur} className={ic} placeholder="00000-000" />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Logradouro *</label>
          <input value={f("address")} onChange={e => set("address", e.target.value)} className={ic} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Número *</label>
          <input value={f("number")} onChange={e => set("number", e.target.value)} className={ic} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
          <input value={f("complement")} onChange={e => set("complement", e.target.value)} className={ic} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Bairro *</label>
          <input value={f("neighborhood")} onChange={e => set("neighborhood", e.target.value)} className={ic} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">UF *</label>
          <select value={f("state")} onChange={e => set("state", e.target.value)} className={ic}>
            <option value="">Selecione...</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Cidade *</label>
          <input value={f("city")} onChange={e => set("city", e.target.value)} className={ic} />
        </div>
      </div>

      {extraField}
    </fieldset>
  );
}
