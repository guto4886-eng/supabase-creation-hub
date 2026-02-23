import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "name", label: "Nome da Obra", required: true },
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
];

export default function Obras() {
  return <CrudPage table="obras" queryKey="obras" title="Obras" fields={fields} defaultValues={{ status: "planejamento" }} hasActive />;
}
