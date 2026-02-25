import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

export async function generateVehicleReport(vehicle: any, companyName?: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório do Veículo", pageWidth / 2, y, { align: "center" });
  y += 8;
  if (companyName) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyName, pageWidth / 2, y, { align: "center" });
    y += 6;
  }
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Vehicle Data
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Veículo", 14, y);
  y += 2;

  const vehicleData = [
    ["Placa", vehicle.plate || "—"],
    ["Marca/Modelo", `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "—"],
    ["Ano Fab./Modelo", `${vehicle.year_manufacture || "—"} / ${vehicle.year_model || "—"}`],
    ["Cor", vehicle.color || "—"],
    ["Categoria", vehicle.category || "—"],
    ["Combustível", vehicle.fuel_type || "—"],
    ["RENAVAM", vehicle.renavam || "—"],
    ["Chassi", vehicle.chassis || "—"],
    ["KM Atual", vehicle.km_current ? Number(vehicle.km_current).toLocaleString("pt-BR") : "—"],
    ["Proprietário", vehicle.owner_name || "—"],
    ["CPF/CNPJ Proprietário", vehicle.owner_document || "—"],
    ["Valor Aquisição", vehicle.acquisition_value ? Number(vehicle.acquisition_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"],
    ["Data Aquisição", vehicle.acquisition_date || "—"],
    ["Valor de Mercado", vehicle.market_value ? Number(vehicle.market_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"],
    ["Taxa Depreciação", vehicle.depreciation_rate ? `${vehicle.depreciation_rate}% a.a.` : "—"],
    ["Status", vehicle.status || "—"],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: vehicleData,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Documents
  const { data: docs } = await supabase.from("vehicle_documents" as any).select("*").eq("vehicle_id", vehicle.id).order("due_date", { ascending: false });
  if (docs && docs.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Documentos e Taxas", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Descrição", "Ano Ref.", "Vencimento", "Valor", "Status"]],
      body: (docs as any[]).map(d => [
        d.doc_type, d.description || "", d.reference_year || "",
        d.due_date || "", d.value ? Number(d.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
        d.status,
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 120, 20] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Insurance
  const { data: insurance } = await supabase.from("vehicle_insurance" as any).select("*").eq("vehicle_id", vehicle.id).order("created_at", { ascending: false });
  if (insurance && insurance.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Seguros", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Seguradora", "Apólice", "Vigência", "Prêmio", "Franquia", "Status"]],
      body: (insurance as any[]).map(i => [
        i.insurer, i.policy_number || "",
        `${i.start_date || "—"} a ${i.end_date || "—"}`,
        i.premium_value ? Number(i.premium_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
        i.deductible_value ? Number(i.deductible_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
        i.status,
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 120, 20] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Maintenances
  const { data: maints } = await supabase.from("vehicle_maintenances" as any).select("*").eq("vehicle_id", vehicle.id).order("service_date", { ascending: false });
  if (maints && maints.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Manutenções", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Descrição", "Data", "KM", "Custo"]],
      body: (maints as any[]).map(m => [
        m.maintenance_type, m.description || "",
        m.service_date || "", m.km_at_service ? Number(m.km_at_service).toLocaleString("pt-BR") : "",
        m.cost ? Number(m.cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 120, 20] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Fueling
  const { data: fuels } = await supabase.from("vehicle_fueling" as any).select("*").eq("vehicle_id", vehicle.id).order("fueling_date", { ascending: false });
  if (fuels && fuels.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Abastecimentos", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Data", "Combustível", "Litros", "Preço/L", "Total", "KM"]],
      body: (fuels as any[]).map(f => [
        f.fueling_date || "", f.fuel_type || "",
        f.liters ? Number(f.liters).toLocaleString("pt-BR") : "",
        f.price_per_liter ? Number(f.price_per_liter).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
        f.total_cost ? Number(f.total_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
        f.km_at_fueling ? Number(f.km_at_fueling).toLocaleString("pt-BR") : "",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [180, 120, 20] },
    });
  }

  doc.save(`relatorio_veiculo_${vehicle.plate || "sem_placa"}.pdf`);
}
