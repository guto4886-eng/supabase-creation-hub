import CrudPage, { FieldDef } from "@/components/CrudPage";
import ClientContacts from "@/components/ClientContacts";
import ClientMessages from "@/components/ClientMessages";
import ClientPortalPermissions from "@/components/ClientPortalPermissions";

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
  { name: "profession", label: "Profissão", hideInTable: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Telefone", type: "tel" },
  { name: "cellphone", label: "Celular", type: "tel", hideInTable: true },
  { name: "cep", label: "CEP", type: "cep", hideInTable: true },
  { name: "address", label: "Logradouro", hideInTable: true },
  { name: "address_number", label: "Número", hideInTable: true },
  { name: "neighborhood", label: "Bairro", hideInTable: true },
  { name: "complement", label: "Complemento", hideInTable: true },
  { name: "city", label: "Cidade" },
  { name: "state", label: "UF" },
  { name: "notes", label: "Observações", type: "textarea", hideInTable: true },
];

const extraTabs = [
  {
    key: "contacts",
    label: "Contatos",
    render: (item: any) => <ClientContacts clientId={item.id} />,
  },
  {
    key: "messages",
    label: "Atendimento",
    render: (item: any) => <ClientMessages clientId={item.id} />,
  },
  {
    key: "portal",
    label: "Portal",
    render: (item: any) => <ClientPortalPermissions clientId={item.id} />,
  },
];

export default function Clients() {
  return (
    <CrudPage
      table="clients"
      queryKey="clients"
      title="Clientes"
      fields={fields}
      hasActive
      hasAttachments
      hasImport
      extraTabs={extraTabs}
    />
  );
}
