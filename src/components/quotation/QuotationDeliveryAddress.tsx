import { useState, useEffect } from "react";
import { fetchCep } from "@/utils/cep";
import { toast } from "sonner";

const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm";

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Props {
  form: Record<string, any>;
  setForm: (fn: (prev: Record<string, any>) => Record<string, any>) => void;
  obras: { id: string; name: string; address?: string; address_number?: string; neighborhood?: string; city?: string; state?: string; cep?: string; complement?: string }[];
}

export default function QuotationDeliveryAddress({ form, setForm, obras }: Props) {
  const [loadingCep, setLoadingCep] = useState(false);
  const source = form.delivery_address_source || "obra";

  const handleSourceChange = (val: string) => {
    setForm(p => ({ ...p, delivery_address_source: val }));
    if (val === "obra" && form.obra_id) {
      const obra = obras.find(o => o.id === form.obra_id);
      if (obra) {
        setForm(p => ({
          ...p,
          delivery_address_source: "obra",
          delivery_cep: (obra as any).cep || "",
          delivery_address: (obra as any).address || "",
          delivery_number: (obra as any).address_number || "",
          delivery_neighborhood: (obra as any).neighborhood || "",
          delivery_city: (obra as any).city || "",
          delivery_state: (obra as any).state || "",
          delivery_complement: (obra as any).complement || "",
        }));
      }
    }
  };

  const handleCep = async (cep: string) => {
    setForm(p => ({ ...p, delivery_cep: cep }));
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      setLoadingCep(true);
      const data = await fetchCep(clean);
      setLoadingCep(false);
      if (data) {
        setForm(p => ({
          ...p,
          delivery_address: data.address,
          delivery_neighborhood: data.neighborhood,
          delivery_city: data.city,
          delivery_state: data.state,
        }));
      } else {
        toast.error("CEP não encontrado");
      }
    }
  };

  const isCustom = source === "custom";

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-sm font-semibold text-primary">Endereço de Entrega</h4>

      <div className="flex items-center gap-6">
        {[{ value: "obra", label: "Mesmo da obra" }, { value: "custom", label: "Endereço personalizado" }].map(opt => (
          <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="delivery_src" value={opt.value}
              checked={source === opt.value}
              onChange={() => handleSourceChange(opt.value)}
              className="accent-primary" />
            {opt.label}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">CEP</label>
          <input value={form.delivery_cep || ""} onChange={e => handleCep(e.target.value)}
            className={inputClass} disabled={!isCustom} placeholder="00000-000" />
          {loadingCep && <span className="text-xs text-muted-foreground">Buscando...</span>}
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1">Logradouro</label>
          <input value={form.delivery_address || ""} onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
            className={inputClass} disabled={!isCustom} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Número</label>
          <input value={form.delivery_number || ""} onChange={e => setForm(p => ({ ...p, delivery_number: e.target.value }))}
            className={inputClass} disabled={!isCustom} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Complemento</label>
          <input value={form.delivery_complement || ""} onChange={e => setForm(p => ({ ...p, delivery_complement: e.target.value }))}
            className={inputClass} disabled={!isCustom} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Bairro</label>
          <input value={form.delivery_neighborhood || ""} onChange={e => setForm(p => ({ ...p, delivery_neighborhood: e.target.value }))}
            className={inputClass} disabled={!isCustom} />
        </div>
        <div />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Cidade</label>
          <input value={form.delivery_city || ""} onChange={e => setForm(p => ({ ...p, delivery_city: e.target.value }))}
            className={inputClass} disabled={!isCustom} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
          <select value={form.delivery_state || ""} onChange={e => setForm(p => ({ ...p, delivery_state: e.target.value }))}
            className={inputClass} disabled={!isCustom}>
            <option value="">Selecione...</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div />
      </div>
    </div>
  );
}
