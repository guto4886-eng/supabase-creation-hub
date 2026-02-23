import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "title", label: "Título", required: true },
  { name: "status", label: "Status", type: "select", options: [
    { value: "aberta", label: "Aberta" },
    { value: "em_analise", label: "Em análise" },
    { value: "fechada", label: "Fechada" },
  ] },
  { name: "deadline", label: "Prazo", type: "date" },
  { name: "description", label: "Descrição", type: "textarea", hideInTable: true },
];

export default function Quotations() {
  return <CrudPage table="quotations" queryKey="quotations" title="Cotações" fields={fields} defaultValues={{ status: "aberta" }} />;
}
