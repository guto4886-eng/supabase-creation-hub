import CrudPage from "@/components/CrudPage";
import VehicleDocuments from "@/components/VehicleDocuments";
import VehicleMaintenances from "@/components/VehicleMaintenances";
import VehicleFueling from "@/components/VehicleFueling";

const CATEGORY_OPTIONS = [
  { value: "carro", label: "Carro" },
  { value: "caminhonete", label: "Caminhonete" },
  { value: "caminhao", label: "Caminhão" },
  { value: "van", label: "Van" },
  { value: "moto", label: "Moto" },
  { value: "maquina", label: "Máquina/Equipamento" },
  { value: "outro", label: "Outro" },
];

const FUEL_OPTIONS = [
  { value: "flex", label: "Flex" },
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "gnv", label: "GNV" },
  { value: "eletrico", label: "Elétrico" },
  { value: "hibrido", label: "Híbrido" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "manutencao", label: "Em Manutenção" },
  { value: "inativo", label: "Inativo" },
];

const fields = [
  { name: "plate", label: "Placa", required: true },
  { name: "brand", label: "Marca" },
  { name: "model", label: "Modelo" },
  { name: "year_manufacture", label: "Ano Fabricação", type: "number" as const },
  { name: "year_model", label: "Ano Modelo", type: "number" as const },
  { name: "color", label: "Cor" },
  { name: "category", label: "Categoria", type: "select" as const, options: CATEGORY_OPTIONS },
  { name: "fuel_type", label: "Combustível", type: "select" as const, options: FUEL_OPTIONS },
  { name: "renavam", label: "RENAVAM", hideInTable: true },
  { name: "chassis", label: "Chassi", hideInTable: true },
  { name: "owner_name", label: "Proprietário" },
  { name: "owner_document", label: "CPF/CNPJ Proprietário", hideInTable: true },
  { name: "acquisition_date", label: "Data Aquisição", type: "date" as const, hideInTable: true },
  { name: "acquisition_value", label: "Valor Aquisição", type: "number" as const, hideInTable: true },
  { name: "km_current", label: "KM Atual", type: "number" as const },
  { name: "status", label: "Status", type: "select" as const, options: STATUS_OPTIONS },
  { name: "notes", label: "Observações", type: "textarea" as const, hideInTable: true },
];

export default function Fleet() {
  return (
    <CrudPage
      table="vehicles"
      queryKey="vehicles"
      title="Frota"
      fields={fields}
      defaultValues={{ category: "carro", fuel_type: "flex", status: "ativo", km_current: 0 }}
      hasActive
      hasAttachments
      extraTabs={[
        {
          key: "documentos",
          label: "Documentos/Taxas",
          render: (item) => <VehicleDocuments vehicleId={item.id} />,
        },
        {
          key: "manutencoes",
          label: "Manutenções",
          render: (item) => <VehicleMaintenances vehicleId={item.id} />,
        },
        {
          key: "abastecimentos",
          label: "Abastecimentos",
          render: (item) => <VehicleFueling vehicleId={item.id} />,
        },
      ]}
    />
  );
}
