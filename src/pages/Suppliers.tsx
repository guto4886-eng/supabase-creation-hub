import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "name", label: "Nome", required: true },
  { name: "document", label: "CPF/CNPJ" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Telefone", type: "tel" },
  { name: "category", label: "Categoria" },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF" },
  { name: "address", label: "Endereço", hideInTable: true },
  { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
];

export default function Suppliers() {
  return <CrudPage table="suppliers" queryKey="suppliers" title="Fornecedores" fields={fields} />;
}
