import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "name", label: "Nome", required: true },
  { name: "document", label: "CPF/CNPJ", type: "cpfcnpj" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Telefone", type: "tel" },
  { name: "cep", label: "CEP", type: "cep", hideInTable: true },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF" },
  { name: "address", label: "Endereço", hideInTable: true },
  { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
];

export default function Clients() {
  return <CrudPage table="clients" queryKey="clients" title="Clientes" fields={fields} hasActive />;
}
