import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "name", label: "Nome", required: true },
  { name: "description", label: "Descrição", type: "textarea", hideInTable: true },
  { name: "status", label: "Status", type: "select", options: [
    { value: "rascunho", label: "Rascunho" },
    { value: "aprovado", label: "Aprovado" },
    { value: "rejeitado", label: "Rejeitado" },
  ] },
  { name: "total_value", label: "Valor total", type: "number" },
];

export default function Budgets() {
  return <CrudPage table="budgets" queryKey="budgets" title="Orçamentos" fields={fields} defaultValues={{ status: "rascunho" }} />;
}
