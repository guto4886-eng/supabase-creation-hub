import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CrudPage, { FieldDef } from "@/components/CrudPage";
import { useMemo } from "react";

export default function Obras() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients_select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const fields: FieldDef[] = useMemo(() => [
    { name: "name", label: "Nome da Obra", required: true },
    {
      name: "client_id", label: "Cliente", type: "select",
      options: clients.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "status", label: "Status", type: "select", options: [
      { value: "planejamento", label: "Planejamento" },
      { value: "em_andamento", label: "Em andamento" },
      { value: "pausada", label: "Pausada" },
      { value: "concluida", label: "Concluída" },
    ] },
    { name: "cep", label: "CEP", type: "cep", hideInTable: true },
    { name: "city", label: "Cidade" },
    { name: "state", label: "UF" },
    { name: "start_date", label: "Início", type: "date" },
    { name: "expected_end_date", label: "Previsão término", type: "date" },
    { name: "total_budget", label: "Orçamento total", type: "number", hideInTable: true },
    { name: "address", label: "Endereço", hideInTable: true },
    { name: "description", label: "Descrição", type: "textarea", hideInTable: true },
    { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
  ], [clients]);

  return <CrudPage table="obras" queryKey="obras" title="Obras" fields={fields} defaultValues={{ status: "planejamento" }} hasActive hasAttachments />;
}
