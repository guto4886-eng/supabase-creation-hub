import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  addReportHeader, addPageFooter, drawInfoGrid, loadImage,
  fetchCompanyInfo, type CompanyInfo,
  fmtCurrency as fmt, fmtQty, fmtDate,
  TABLE_THEME, TABLE_THEME_GREEN,
} from "./pdfHeader";

// Re-export for backward compatibility
export { fetchCompanyInfo, type CompanyInfo };

// ═══════════════════════════════════════════════════════════════
// ORDEM DE COMPRA PDF
// ═══════════════════════════════════════════════════════════════
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

  let y = await addReportHeader(doc, companyInfo, "ORDEM DE COMPRA", `Código: ${order.order_code || "—"}`);

  // Info grid
  const infoRows: [string, string, string?, string?][] = [
    ["Fornecedor:", supplierName, "Empresa:", companyName],
    ["Obra:", obraName, "Status:", order.status || "—"],
    ["Data Emissão:", fmtDate(order.order_date), "Dt. Entrega:", fmtDate(order.delivery_date)],
    ["Cond. Pagamento:", order.payment_terms || "—"],
  ];
  if (order.delivery_receiver) {
    infoRows.push(["Recebedor:", order.delivery_receiver]);
  }
  y = drawInfoGrid(doc, infoRows, y);

  // Delivery address
  const deliveryParts = [order.delivery_address, order.delivery_number, order.delivery_neighborhood, order.delivery_city, order.delivery_state].filter(Boolean);
  if (deliveryParts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("End. Entrega:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(deliveryParts.join(", "), 50, y);
    y += 5;
  }

  if (order.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Observações:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const noteLines = doc.splitTextToSize(order.notes, 145);
    doc.text(noteLines, 50, y);
    y += noteLines.length * 4 + 2;
  }

  y += 4;
  doc.setTextColor(0, 0, 0);

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
    ...TABLE_THEME,
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
    margin: { bottom: 20 },
  });

  // Totals box
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY + 6;

  const pageW = doc.internal.pageSize.getWidth();
  const boxW = 80;
  const boxX = pageW - 14 - boxW;

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalItems = items.reduce((s, i) => s + i.total, 0);
  const globalDiscount = Number(order.discount_value) || (Number(order.discount_percent) > 0 ? totalItems * (Number(order.discount_percent) / 100) : 0);
  const globalFreight = Number(order.freight) || 0;
  const grandTotal = Number(order.total_value) || Math.max(0, totalItems - globalDiscount + globalFreight);

  doc.setFillColor(245, 248, 252);
  doc.setDrawColor(200, 210, 220);
  doc.roundedRect(boxX, ty - 3, boxW, (globalDiscount > 0 ? 26 : 21) + (globalFreight > 0 ? 5 : 0), 2, 2, "FD");

  doc.setFontSize(8.5);
  const labelX = boxX + 4;
  const valX = boxX + boxW - 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Subtotal Itens:", labelX, ty);
  doc.text(fmt(subtotal), valX, ty, { align: "right" });
  ty += 5;

  if (globalDiscount > 0) {
    doc.text("Desconto:", labelX, ty);
    doc.setTextColor(200, 50, 50);
    doc.text(`- ${fmt(globalDiscount)}`, valX, ty, { align: "right" });
    doc.setTextColor(80, 80, 80);
    ty += 5;
  }

  if (globalFreight > 0) {
    doc.text("Frete:", labelX, ty);
    doc.text(fmt(globalFreight), valX, ty, { align: "right" });
    ty += 5;
  }

  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.4);
  doc.line(labelX, ty - 2, valX, ty - 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(41, 128, 185);
  doc.text("TOTAL:", labelX, ty + 2);
  doc.text(fmt(grandTotal), valX, ty + 2, { align: "right" });

  addPageFooter(doc);
  doc.save(`OC_${order.order_code || "sem-codigo"}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// HISTÓRICO DE RECEBIMENTO PDF
// ═══════════════════════════════════════════════════════════════
interface ReceivingHistoryData {
  order: Record<string, any>;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }>;
  receivings: Array<{
    purchase_order_item_id: string;
    quantity: number;
    delivery_date: string | null;
    received_at: string;
    romaneio: string | null;
    receiver: string | null;
    notes: string | null;
  }>;
  supplierName: string;
  obraName: string;
  userId: string;
}

export async function generateReceivingHistoryPDF(data: ReceivingHistoryData) {
  const { order, items, receivings, supplierName, obraName, userId } = data;
  const doc = new jsPDF();
  const companyInfo = await fetchCompanyInfo(userId);

  let y = await addReportHeader(doc, companyInfo, "HISTÓRICO DE RECEBIMENTO", `OC: ${order.order_code || "—"}`);

  y = drawInfoGrid(doc, [
    ["Fornecedor:", supplierName, "Data OC:", fmtDate(order.order_date)],
    ["Obra:", obraName, "Status:", order.status || "—"],
  ], y);
  y += 4;

  // Receivings detail table
  const itemMap = new Map(items.map(i => [i.id, i]));
  const sorted = [...receivings].sort((a, b) => a.received_at.localeCompare(b.received_at));

  const head = [["Item", "Qtd. Total", "Data Entrega", "Data Registro", "Romaneio", "Recebedor", "Qtd. Recebida", "Obs."]];
  const body = sorted.map(r => {
    const item = itemMap.get(r.purchase_order_item_id);
    return [
      item?.description || "—",
      item ? fmtQty(item.quantity) : "—",
      fmtDate(r.delivery_date),
      new Date(r.received_at).toLocaleDateString("pt-BR"),
      r.romaneio || "—",
      r.receiver || "—",
      fmtQty(r.quantity),
      r.notes || "",
    ];
  });

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(140, 140, 140);
    doc.text("Nenhum recebimento registrado.", 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head,
      body,
      ...TABLE_THEME,
      columnStyles: {
        1: { halign: "right" },
        6: { halign: "right" },
      },
      margin: { bottom: 20 },
    });
  }

  // Summary per item
  const finalY = (doc as any).lastAutoTable?.finalY || y + 5;
  let sy = finalY + 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(39, 174, 96);
  doc.text("RESUMO POR ITEM", 14, sy);
  sy += 6;
  doc.setTextColor(0, 0, 0);

  const summaryHead = [["Item", "Un.", "Qtd. Total", "Qtd. Recebida", "Saldo", "% Recebido"]];
  const summaryBody = items.map(item => {
    const totalReceived = receivings
      .filter(r => r.purchase_order_item_id === item.id)
      .reduce((s, r) => s + Number(r.quantity), 0);
    const remaining = Math.max(0, item.quantity - totalReceived);
    const pct = item.quantity > 0 ? (totalReceived / item.quantity) * 100 : 0;
    return [
      item.description,
      item.unit,
      fmtQty(item.quantity),
      fmtQty(totalReceived),
      fmtQty(remaining),
      `${pct.toFixed(1)}%`,
    ];
  });

  autoTable(doc, {
    startY: sy,
    head: summaryHead,
    body: summaryBody,
    ...TABLE_THEME_GREEN,
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { bottom: 20 },
  });

  // Overall progress
  const sy2 = (doc as any).lastAutoTable?.finalY || sy + 20;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalRec = receivings.reduce((s, r) => s + Number(r.quantity), 0);
  const overallPct = totalQty > 0 ? (totalRec / totalQty) * 100 : 0;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(`Progresso Geral: ${overallPct.toFixed(1)}% recebido`, 14, sy2 + 6);

  addPageFooter(doc);
  doc.save(`Recebimento_OC_${order.order_code || "sem-codigo"}.pdf`);
}
