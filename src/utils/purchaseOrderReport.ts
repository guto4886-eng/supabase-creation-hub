import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchCompanyInfo, type CompanyInfo } from "./exportWithHeader";

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtQty = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface POReportData {
  order: Record<string, any>;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount_value?: number;
    discount_percent?: number;
    freight?: number;
    total: number;
    phase?: string;
    service?: string;
    brand?: string;
    complement?: string;
  }>;
  supplierName: string;
  obraName: string;
  companyName: string;
  userId: string;
}

export async function generatePurchaseOrderPDF(data: POReportData) {
  const { order, items, supplierName, obraName, companyName, userId } = data;
  const doc = new jsPDF();
  const companyInfo = await fetchCompanyInfo(userId);

  let y = 15;

  // Company header
  if (companyInfo) {
    if (companyInfo.logo_url) {
      try {
        const img = await loadImage(companyInfo.logo_url);
        doc.addImage(img, "JPEG", 14, 10, 22, 22);
        y = 12;
      } catch { /* skip logo */ }
    }

    const textX = companyInfo.logo_url ? 40 : 14;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    if (companyInfo.company_name) {
      doc.text(companyInfo.company_name, textX, y);
      y += 5;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    if (companyInfo.document) { doc.text(`CNPJ/CPF: ${companyInfo.document}`, textX, y); y += 4; }
    const addr = [companyInfo.address, companyInfo.city, companyInfo.state].filter(Boolean).join(" - ");
    if (addr) { doc.text(addr, textX, y); y += 4; }
    if (companyInfo.phone) { doc.text(`Tel: ${companyInfo.phone}`, textX, y); y += 4; }
    if (companyInfo.email) { doc.text(companyInfo.email, textX, y); y += 4; }
    y += 3;
  }

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text("ORDEM DE COMPRA", 14, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  // Order info grid
  doc.setFontSize(9);
  const infoRows = [
    ["Código:", order.order_code || "—", "Data:", order.order_date ? new Date(order.order_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
    ["Fornecedor:", supplierName, "Empresa:", companyName],
    ["Obra:", obraName, "Status:", order.status || "—"],
    ["Cond. Pagamento:", order.payment_terms || "—", "Dt. Entrega:", order.delivery_date ? new Date(order.delivery_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
  ];

  if (order.delivery_receiver) {
    infoRows.push(["Recebedor:", order.delivery_receiver, "", ""]);
  }

  infoRows.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0], 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[1], 45, y);
    if (row[2]) {
      doc.setFont("helvetica", "bold");
      doc.text(row[2], 115, y);
      doc.setFont("helvetica", "normal");
      doc.text(row[3], 148, y);
    }
    y += 5;
  });

  // Delivery address
  const deliveryParts = [order.delivery_address, order.delivery_number, order.delivery_neighborhood, order.delivery_city, order.delivery_state].filter(Boolean);
  if (deliveryParts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("End. Entrega:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(deliveryParts.join(", "), 45, y);
    y += 5;
  }

  if (order.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 14, y);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(order.notes, 150);
    doc.text(noteLines, 45, y);
    y += noteLines.length * 4 + 2;
  }

  y += 4;

  // Items table
  const head = [["#", "Descrição", "Marca", "Qtd.", "Un.", "Vlr. Unit.", "Desc.", "Frete", "Total"]];
  const body = items.map((it, idx) => [
    String(idx + 1),
    it.description + (it.complement ? ` (${it.complement})` : ""),
    it.brand || "",
    fmtQty(it.quantity),
    it.unit,
    fmt(it.unit_price),
    it.discount_value ? fmt(it.discount_value) : it.discount_percent ? `${it.discount_percent}%` : "—",
    it.freight ? fmt(it.freight) : "—",
    fmt(it.total),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY + 6;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalItems = items.reduce((s, i) => s + i.total, 0);
  const globalDiscount = Number(order.discount_value) || (Number(order.discount_percent) > 0 ? totalItems * (Number(order.discount_percent) / 100) : 0);
  const globalFreight = Number(order.freight) || 0;
  const grandTotal = Number(order.total_value) || Math.max(0, totalItems - globalDiscount + globalFreight);

  doc.setFontSize(9);
  const totalsX = 140;
  const totalsValX = 175;

  doc.setFont("helvetica", "normal");
  doc.text("Subtotal Itens:", totalsX, ty, { align: "right" });
  doc.text(fmt(subtotal), totalsValX, ty, { align: "right" });
  ty += 5;

  if (globalDiscount > 0) {
    doc.text("Desconto:", totalsX, ty, { align: "right" });
    doc.text(`- ${fmt(globalDiscount)}`, totalsValX, ty, { align: "right" });
    ty += 5;
  }

  if (globalFreight > 0) {
    doc.text("Frete:", totalsX, ty, { align: "right" });
    doc.text(fmt(globalFreight), totalsValX, ty, { align: "right" });
    ty += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", totalsX, ty, { align: "right" });
  doc.text(fmt(grandTotal), totalsValX, ty, { align: "right" });

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, pageH - 10);

  doc.save(`OC_${order.order_code || "sem-codigo"}.pdf`);
}
