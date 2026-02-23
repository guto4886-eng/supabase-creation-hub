import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "description", label: "Descrição", required: true },
  { name: "type", label: "Tipo", type: "select", required: true, options: [
    { value: "despesa", label: "Despesa" },
    { value: "receita", label: "Receita" },
  ] },
  { name: "value", label: "Valor (R$)", type: "number", required: true },
  { name: "status", label: "Status", type: "select", options: [
    { value: "pendente", label: "Pendente" },
    { value: "pago", label: "Pago" },
    { value: "cancelado", label: "Cancelado" },
  ] },
  { name: "due_date", label: "Vencimento", type: "date" },
  { name: "payment_date", label: "Pagamento", type: "date", hideInTable: true },
  { name: "category", label: "Categoria" },
  { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
];

export default function Financial() {
  return <CrudPage table="financial_docs" queryKey="financial_docs" title="Financeiro" fields={fields} defaultValues={{ type: "despesa", status: "pendente" }} />;
}
