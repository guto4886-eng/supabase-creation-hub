import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
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

// ── Section header bar helper ──
function drawSectionHeader(doc: jsPDF, text: string, y: number, pageW: number): number {
  const M = 14;
  doc.setFillColor(220, 220, 220);
  doc.rect(M, y, pageW - M * 2, 6, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(text, M + 2, y + 4.2);
  doc.setTextColor(0, 0, 0);
  return y + 9;
}

// ── Field pair helper ──
function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, maxValW: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const labelW = doc.getTextWidth(label) + 1;
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const valLines = doc.splitTextToSize(value || "—", maxValW);
  doc.text(valLines, x + labelW, y);
  return Array.isArray(valLines) ? valLines.length : 1;
}

// ── Check page break ──
function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 20) {
    doc.addPage();
    return 15;
  }
  return y;
}

export async function generatePurchaseOrderPDF(data: POReportData) {
  const { order, items, supplierName, obraName, companyName, userId } = data;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const M = 14;
  const halfW = (pageW - M * 2) / 2;

  // Fetch additional data
  const companyInfo = await fetchCompanyInfo(userId);

  // Fetch supplier details
  let supplier: Record<string, any> | null = null;
  if (order.supplier_id) {
    const { data: s } = await supabase.from("suppliers" as any).select("*").eq("id", order.supplier_id).maybeSingle();
    supplier = s as any;
  }

  // Fetch billing company details
  let billingCompany: Record<string, any> | null = null;
  if (order.company_id) {
    const { data: c } = await supabase.from("companies").select("*").eq("id", order.company_id).maybeSingle();
    billingCompany = c;
  }

  // Fetch vendor contact
  let vendorContact: Record<string, any> | null = null;
  if (order.vendor_contact_id) {
    const { data: vc } = await supabase.from("supplier_contacts" as any).select("*").eq("id", order.vendor_contact_id).maybeSingle();
    vendorContact = vc as any;
  }

  // Fetch user profile
  let profile: Record<string, any> | null = null;
  const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  profile = prof;

  // Fetch obra details
  let obraDetail: Record<string, any> | null = null;
  if (order.obra_id) {
    const { data: ob } = await supabase.from("obras").select("*").eq("id", order.obra_id).maybeSingle();
    obraDetail = ob;
  }

  // ── Header ── Use billing company data if available, fallback to company_settings
  let headerInfo: CompanyInfo | null = companyInfo;
  if (billingCompany) {
    headerInfo = {
      company_name: billingCompany.name || billingCompany.trade_name || null,
      document: billingCompany.document || null,
      logo_url: billingCompany.logo_url || null,
      address: [billingCompany.address, billingCompany.address_number, billingCompany.neighborhood].filter(Boolean).join(", ") || null,
      city: billingCompany.city || null,
      state: billingCompany.state || null,
      phone: billingCompany.phone || billingCompany.cellphone || null,
      email: billingCompany.email || null,
    };
  }

  const titleParts = [`ORDEM DE COMPRA ${order.order_code || ""}`];
  const subtitleParts: string[] = [];
  if (obraName && obraName !== "—") subtitleParts.push(obraName);
  
  let y = await addReportHeader(doc, headerInfo, titleParts[0], subtitleParts.length > 0 ? subtitleParts.join(" - ") : undefined);

  // ════════════════════════════════════════
  // DADOS DA ORDEM DE COMPRA
  // ════════════════════════════════════════
  y = drawSectionHeader(doc, `DADOS DA ORDEM DE COMPRA     ${order.order_code || ""}`, y, pageW);

  drawField(doc, "Data:", fmtDate(order.order_date), M + 2, y, 30);
  drawField(doc, "Previsão da entrega:", fmtDate(order.delivery_date), pageW / 2, y, 30);
  y += 5;

  drawField(doc, "Cond. pgto.:", order.payment_terms || "—", M + 2, y, 40);
  drawField(doc, "Forma pgto.:", order.payment_method || "—", pageW / 2, y, 40);
  y += 5;

  // Notes / Observação
  if (order.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Observação:", M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const noteLines = doc.splitTextToSize(order.notes, pageW - M * 2 - 30);
    doc.text(noteLines, M + 28, y);
    y += (Array.isArray(noteLines) ? noteLines.length : 1) * 3.5 + 2;
  }
  y += 2;

  // ════════════════════════════════════════
  // RESPONSÁVEL PELA COMPRA
  // ════════════════════════════════════════
  y = checkPageBreak(doc, y, 20);
  y = drawSectionHeader(doc, "RESPONSÁVEL PELA COMPRA", y, pageW);
  
  const buyerName = companyInfo?.company_name || companyName || "—";
  const profileName = profile?.full_name || "—";
  const profileEmail = companyInfo?.email || "—";

  drawField(doc, "Nome:", buyerName, M + 2, y, halfW - 10);
  drawField(doc, "Comprador:", profileName, pageW / 2, y, halfW - 10);
  y += 5;
  drawField(doc, "", "", M + 2, y, 1);
  drawField(doc, "Email:", profileEmail, pageW / 2, y, halfW - 10);
  y += 7;

  // ════════════════════════════════════════
  // DADOS DO FATURAMENTO
  // ════════════════════════════════════════
  y = checkPageBreak(doc, y, 30);
  y = drawSectionHeader(doc, "DADOS DO FATURAMENTO", y, pageW);

  const fatName = billingCompany?.name || companyInfo?.company_name || "—";
  const fatCnpj = billingCompany?.document || companyInfo?.document || "—";
  const fatIe = billingCompany?.ie || "—";
  const fatAddrParts = [
    billingCompany?.address || order.billing_address,
    billingCompany?.address_number || order.billing_number,
    billingCompany?.neighborhood || order.billing_neighborhood,
    billingCompany?.city || order.billing_city,
    billingCompany?.state || order.billing_state,
    order.billing_cep,
  ].filter(Boolean);
  const fatAddr = fatAddrParts.length > 0 ? fatAddrParts.join(", ") : "—";

  drawField(doc, "Nome:", fatName, M + 2, y, halfW - 10);
  const addrLines1 = drawField(doc, "Endereço:", fatAddr, pageW / 2, y, halfW - 15);
  y += Math.max(1, addrLines1) * 3.5 + 1.5;
  
  drawField(doc, "CNPJ:", fatCnpj, M + 2, y, halfW - 10);
  y += 5;
  drawField(doc, "I.E.:", fatIe, M + 2, y, halfW - 10);
  y += 7;

  // ════════════════════════════════════════
  // DADOS DO FORNECEDOR
  // ════════════════════════════════════════
  y = checkPageBreak(doc, y, 35);
  y = drawSectionHeader(doc, "DADOS DO FORNECEDOR", y, pageW);

  const supName = supplier?.name || supplierName || "—";
  const supCnpj = supplier?.document || "—";
  const supPhone = supplier?.phone || "—";
  const supCell = supplier?.cellphone || "—";
  const supEmail = supplier?.email || "—";
  const supAddrParts = [
    supplier?.address, supplier?.address_number,
    supplier?.neighborhood, supplier?.city,
    supplier?.state, supplier?.cep,
  ].filter(Boolean);
  const supAddr = supAddrParts.length > 0 ? supAddrParts.join(", ") : "—";
  const vendorName = vendorContact?.name || "—";

  drawField(doc, "Nome:", supName, M + 2, y, halfW - 10);
  const supAddrLines = drawField(doc, "Endereço:", supAddr, pageW / 2, y, halfW - 15);
  y += Math.max(1, supAddrLines) * 3.5 + 1.5;

  drawField(doc, "CNPJ:", supCnpj, M + 2, y, halfW - 10);
  y += 5;

  drawField(doc, "Telefone:", supPhone, M + 2, y, 25);
  drawField(doc, "Celular:", supCell, M + 55, y, 25);
  y += 5;

  drawField(doc, "Vendedor:", vendorName, M + 2, y, halfW - 10);
  y += 5;

  drawField(doc, "E-mail:", supEmail, M + 2, y, halfW - 10);
  y += 7;

  // ════════════════════════════════════════
  // OBRA / ENDEREÇOS
  // ════════════════════════════════════════
  y = checkPageBreak(doc, y, 50);

  // Obra / Centro de custo header
  doc.setFillColor(220, 220, 220);
  doc.rect(M, y, pageW - M * 2, 6, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("DADOS DA OBRA", M + 2, y + 4.2);
  y += 9;

  // Obra name
  const obraText = obraName && obraName !== "—" ? obraName : "—";
  drawField(doc, "Obra:", obraText, M + 2, y, halfW);
  if (obraDetail?.cno) {
    drawField(doc, "CNO:", obraDetail.cno, pageW / 2, y, 40);
  }
  y += 5;

  if (obraDetail) {
    // Address
    const obraAddr = [obraDetail.address, obraDetail.address_number, obraDetail.complement, obraDetail.neighborhood].filter(Boolean).join(", ");
    const obraCityState = [obraDetail.city, obraDetail.state].filter(Boolean).join("/");
    if (obraAddr || obraCityState) {
      drawField(doc, "Endereço:", [obraAddr, obraCityState, obraDetail.cep].filter(Boolean).join(" - "), M + 2, y, pageW - M * 2 - 30);
      y += 5;
    }

    // Responsáveis
    const resp1 = obraDetail.resp_tecnico ? `Resp. Técnico: ${obraDetail.resp_tecnico}` : "";
    const resp2 = obraDetail.resp_obra ? `Resp. Obra: ${obraDetail.resp_obra}` : "";
    if (resp1 || resp2) {
      if (resp1) drawField(doc, "Resp. Técnico:", obraDetail.resp_tecnico, M + 2, y, 50);
      if (resp2) drawField(doc, "Resp. Obra:", obraDetail.resp_obra, pageW / 2, y, 50);
      y += 5;
    }

    // ART + Área
    const hasArt = obraDetail.art_number;
    const hasArea = obraDetail.area_m2;
    if (hasArt || hasArea) {
      if (hasArt) drawField(doc, "ART:", obraDetail.art_number, M + 2, y, 40);
      if (hasArea) drawField(doc, "Área:", `${obraDetail.area_m2} m²`, pageW / 2, y, 40);
      y += 5;
    }
  }
  y += 2;

  // Delivery and billing addresses side by side
  const delAddrParts = [order.delivery_address, order.delivery_number, order.delivery_neighborhood, order.delivery_city, order.delivery_state, order.delivery_cep].filter(Boolean);
  const bilAddrParts = [order.billing_address, order.billing_number, order.billing_neighborhood, order.billing_city, order.billing_state, order.billing_cep].filter(Boolean);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.text("ENDEREÇO ENTREGA:", M + 2, y);
  doc.text("ENDEREÇO COBRANÇA:", pageW / 2, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(30, 30, 30);

  const delAddr = delAddrParts.length > 0 ? delAddrParts.join(", ") : "—";
  const bilAddr = bilAddrParts.length > 0 ? bilAddrParts.join(", ") : "—";
  
  const delLines = doc.splitTextToSize("Endereço: " + delAddr, halfW - 8);
  const bilLines = doc.splitTextToSize("Endereço: " + bilAddr, halfW - 8);
  doc.text(delLines, M + 4, y);
  doc.text(bilLines, pageW / 2 + 2, y);
  y += Math.max(delLines.length, bilLines.length) * 3 + 4;

  // Recebedor
  if (order.delivery_receiver) {
    drawField(doc, "Recebedor:", order.delivery_receiver, M + 2, y, halfW);
    y += 7;
  }

  // ════════════════════════════════════════
  // ITENS
  // ════════════════════════════════════════
  y = checkPageBreak(doc, y, 20);

  const head = [["N.", "Item", "Qtd.", "Unit. (R$)", "Subtotal (R$)", "Desc. (R$)", "Total (R$)"]];
  const body = items.map((it, idx) => {
    const sub = it.quantity * it.unit_price;
    const disc = it.discount_value || (it.discount_percent ? sub * (it.discount_percent / 100) : 0);
    return [
      String(idx + 1),
      it.description + (it.brand ? ` - ${it.brand}` : "") + (it.complement ? ` (${it.complement})` : "") + `\n${fmtQty(it.quantity)} ${it.unit}`,
      fmtQty(it.quantity),
      fmt(it.unit_price),
      fmt(sub),
      fmt(disc || 0),
      fmt(it.total),
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    ...TABLE_THEME,
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 24 },
    },
    margin: { left: M, right: M, bottom: 20 },
  });

  // ── Totals rows ──
  const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
  let ty = finalY;

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalItemDisc = items.reduce((s, i) => {
    const sub = i.quantity * i.unit_price;
    return s + (i.discount_value || (i.discount_percent ? sub * (i.discount_percent / 100) : 0));
  }, 0);
  const totalItems = items.reduce((s, i) => s + i.total, 0);
  const globalDiscount = Number(order.discount_value) || (Number(order.discount_percent) > 0 ? totalItems * (Number(order.discount_percent) / 100) : 0);
  const globalFreight = Number(order.freight) || 0;
  const grandTotal = Number(order.total_value) || Math.max(0, totalItems - globalDiscount + globalFreight);

  // Summary table aligned with items table
  const summaryBody: string[][] = [
    ["Subtotal", fmt(subtotal), fmt(totalItemDisc), fmt(totalItems)],
    ["Frete", "", "", fmt(globalFreight)],
    ["Total", "", "", fmt(grandTotal)],
  ];

  autoTable(doc, {
    startY: ty,
    body: summaryBody,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: "bold", halign: "right", cellWidth: pageW - M * 2 - 68 },
      1: { halign: "right", cellWidth: 22 },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "right", cellWidth: 24, fontStyle: "bold" },
    },
    margin: { left: M, right: M },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.row.index === 2) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 9;
      }
    },
  });

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
