import jsPDF from "jspdf";
import { fetchCompanyInfo, type CompanyInfo } from "./exportWithHeader";

export { fetchCompanyInfo, type CompanyInfo };

// ─── Image loader ───
export function loadImage(url: string): Promise<string> {
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

// ─── Formatters ───
export const fmtCurrency = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtQty = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

export const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ─── Standardized report header ───
export async function addReportHeader(
  doc: jsPDF,
  companyInfo: CompanyInfo | null,
  title: string,
  subtitle?: string,
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const LOGO_X = MARGIN;
  const LOGO_Y = 8;
  const LOGO_W = 20;
  const LOGO_H = 20;
  let logoLoaded = false;

  if (companyInfo) {
    // ── Logo ──
    if (companyInfo.logo_url) {
      try {
        const img = await loadImage(companyInfo.logo_url);
        doc.addImage(img, "JPEG", LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
        logoLoaded = true;
      } catch { /* skip */ }
    }

    // ── Right side: date and page ──
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(dateStr, pageW - MARGIN, LOGO_Y + 4, { align: "right" });
    // Page number is handled by addPageFooter, but we add placeholder position marker
    doc.text("Página  {p}", pageW - MARGIN, LOGO_Y + 8, { align: "right" });

    // ── Center: company info ──
    const textX = logoLoaded ? LOGO_X + LOGO_W + 5 : MARGIN;
    const maxTextW = pageW - MARGIN - textX - 40; // leave room for date on right
    let lineY = LOGO_Y + 4;

    // Company name (bold, larger)
    if (companyInfo.company_name) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      const nameLines = doc.splitTextToSize(companyInfo.company_name, maxTextW);
      doc.text(nameLines, textX, lineY);
      lineY += nameLines.length * 4 + 1;
    }

    // Address line (smaller)
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addrParts = [companyInfo.address, companyInfo.city, companyInfo.state].filter(Boolean);
    if (addrParts.length > 0) {
      const addrText = addrParts.join(" - ");
      const addrLines = doc.splitTextToSize(addrText, maxTextW);
      doc.text(addrLines, textX, lineY);
      lineY += addrLines.length * 3 + 0.5;
    }

    // Email + CNPJ on same line
    const infoParts: string[] = [];
    if (companyInfo.email) infoParts.push(companyInfo.email);
    if (companyInfo.phone) infoParts.push(`Tel: ${companyInfo.phone}`);
    if (companyInfo.document) infoParts.push(`CNPJ: ${companyInfo.document}`);
    if (infoParts.length > 0) {
      const infoText = infoParts.join(" - ");
      const infoLines = doc.splitTextToSize(infoText, maxTextW);
      doc.text(infoLines, textX, lineY);
      lineY += infoLines.length * 3 + 0.5;
    }

    // Ensure we clear the logo area
    const headerBottom = logoLoaded
      ? Math.max(lineY + 2, LOGO_Y + LOGO_H + 2)
      : lineY + 2;

    // ── Blue separator line ──
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, headerBottom, pageW - MARGIN, headerBottom);

    // ── Title + subtitle ──
    const titleY = headerBottom + 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);

    // Title may be long, so wrap it
    const titleMaxW = subtitle ? pageW - MARGIN * 2 - 60 : pageW - MARGIN * 2;
    const titleLines = doc.splitTextToSize(title, titleMaxW);
    doc.text(titleLines, MARGIN, titleY);

    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const subtitleLines = doc.splitTextToSize(subtitle, pageW - MARGIN * 2);
      const subtitleY = titleY + titleLines.length * 4.5;
      doc.text(subtitleLines, MARGIN, subtitleY);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      return subtitleY + subtitleLines.length * 3.5 + 4;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return titleY + titleLines.length * 4.5 + 4;
  }

  // ── No company info — just title ──
  let y = 14;
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text(title, MARGIN, y);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, MARGIN, y + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return y + 12;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

// ─── Standardized page footer ───
export function addPageFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const MARGIN = 14;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Bottom separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 14, pageW - MARGIN, pageH - 14);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, MARGIN, pageH - 9);
    doc.text(`Página ${i} de ${pageCount}`, pageW - MARGIN, pageH - 9, { align: "right" });

    // Also stamp page info in header area (top-right)
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    // Overwrite the placeholder with white rect then write actual page
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW - MARGIN - 30, 13, 30, 5, "F");
    doc.text(`Página  ${i}/${pageCount}`, pageW - MARGIN, 16, { align: "right" });
  }
}

// ─── Info grid helper (label-value pairs) ───
export function drawInfoGrid(doc: jsPDF, rows: [string, string, string?, string?][], startY: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const labelW = 34;
  const col1ValX = MARGIN + labelW;
  const col2X = pageW / 2 + 5;
  const col2ValX = col2X + labelW;
  const maxCol1ValW = col2X - col1ValX - 4;
  const maxCol2ValW = pageW - MARGIN - col2ValX;

  let y = startY;
  doc.setFontSize(8.5);

  rows.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(row[0], MARGIN, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const val1Lines = doc.splitTextToSize(row[1] || "—", maxCol1ValW);
    doc.text(val1Lines, col1ValX, y);

    let rowLines = Array.isArray(val1Lines) ? val1Lines.length : 1;

    if (row[2]) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(row[2], col2X, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const val2Lines = doc.splitTextToSize(row[3] || "—", maxCol2ValW);
      doc.text(val2Lines, col2ValX, y);
      const lines2 = Array.isArray(val2Lines) ? val2Lines.length : 1;
      rowLines = Math.max(rowLines, lines2);
    }

    y += rowLines * 3.5 + 1.5;
  });

  doc.setTextColor(0, 0, 0);
  return y;
}

// ─── Table themes ───
export const TABLE_THEME = {
  styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 30, 30] as [number, number, number] },
  headStyles: {
    fillColor: [41, 128, 185] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    fontSize: 7.5,
  },
  alternateRowStyles: { fillColor: [245, 248, 252] as [number, number, number] },
};

export const TABLE_THEME_GREEN = {
  ...TABLE_THEME,
  headStyles: {
    ...TABLE_THEME.headStyles,
    fillColor: [39, 174, 96] as [number, number, number],
  },
};
