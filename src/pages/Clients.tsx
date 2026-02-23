import CrudPage, { FieldDef } from "@/components/CrudPage";

const fields: FieldDef[] = [
  { name: "name", label: "Nome", required: true },
  {
    name: "person_type",
    label: "Tipo",
    type: "select",
    options: [
      { value: "f", label: "Pessoa Física" },
      { value: "j", label: "Pessoa Jurídica" },
    ],
    hideInTable: true,
  },
  {
    name: "category",
    label: "Categoria",
    type: "select",
    options: [
      { value: "prospect", label: "Prospect" },
      { value: "em_negociacao", label: "Em negociação" },
      { value: "efetivo", label: "Efetivo" },
    ],
  },
  { name: "document", label: "CPF/CNPJ", type: "cpfcnpj" },
  { name: "rg", label: "RG", hideInTable: true },
  { name: "birth_date", label: "Dt. Nasc.", type: "date" },
  {
    name: "nationality",
    label: "Nacionalidade",
    hideInTable: true,
  },
  {
    name: "marital_status",
    label: "Estado Civil",
    type: "select",
    options: [
      { value: "solteiro", label: "Solteiro(a)" },
      { value: "casado", label: "Casado(a)" },
      { value: "divorciado", label: "Divorciado(a)" },
      { value: "viuvo", label: "Viúvo(a)" },
    ],
    hideInTable: true,
  },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Telefone", type: "tel" },
  { name: "cep", label: "CEP", type: "cep", hideInTable: true },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF" },
  { name: "address", label: "Endereço", hideInTable: true },
  { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
];

export default function Clients() {
  return <CrudPage table="clients" queryKey="clients" title="Clientes" fields={fields} hasActive hasAttachments />;
}
