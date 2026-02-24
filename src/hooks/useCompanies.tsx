import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyOption {
  id: string;
  name: string;
  company_type: string;
  parent_id: string | null;
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies_filter_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, company_type, parent_id")
        .eq("active", true)
        .order("company_type")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CompanyOption[];
    },
  });
}

export function CompanyFilterSelect({
  value,
  onChange,
  companies,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  companies: CompanyOption[];
  className?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">Empresa</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className || "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"}
      >
        <option value="">Todas</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.company_type === "filial" ? "↳ " : ""}{c.name}
            {c.company_type === "matriz" ? " (Matriz)" : " (Filial)"}
          </option>
        ))}
      </select>
    </div>
  );
}
