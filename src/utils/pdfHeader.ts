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
  const LOGO_Y = 10;
  const LOGO_W = 22;
  const LOGO_H = 22;
  let logoLoaded = false;

  // ── Company header block ──
  if (companyInfo) {
    // Try loading logo
    if (companyInfo.logo_url) {
      try {
        const img = await loadImage(companyInfo.logo_url);
        doc.addImage(img, "JPEG", LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
        logoLoaded = true;
      } catch { /* skip logo */ }
    }

    const textX = logoLoaded ? LOGO_X + LOGO_W + 6 : MARGIN;
    let lineY = LOGO_Y + 4; // start text aligned with top of logo area

    // Company name
    if (companyInfo.company_name) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(companyInfo.company_name, textX, lineY);
      lineY += 5;
    }

    // Secondary info in smaller font
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    if (companyInfo.document) {
      doc.text(`CNPJ/CPF: ${companyInfo.document}`, textX, lineY);
      lineY += 3.5;
    }

    const addrParts = [companyInfo.address, companyInfo.city, companyInfo.state].filter(Boolean);
    if (addrParts.length > 0) {
      doc.text(addrParts.join(" – "), textX, lineY);
      lineY += 3.5;
    }

    const contactParts: string[] = [];
    if (companyInfo.phone) contactParts.push(`Tel: ${companyInfo.phone}`);
    if (companyInfo.email) contactParts.push(companyInfo.email);
    if (contactParts.length > 0) {
      doc.text(contactParts.join("  |  "), textX, lineY);
      lineY += 3.5;
    }

    // Ensure we're past the logo area before drawing separator
    const headerBottom = logoLoaded
      ? Math.max(lineY, LOGO_Y + LOGO_H + 4)
      : lineY + 2;

    // Separator line
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.7);
    doc.line(MARGIN, headerBottom, pageW - MARGIN, headerBottom);

    // Title row
    const titleY = headerBottom + 7;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text(title, MARGIN, titleY);

    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text(subtitle, pageW - MARGIN, titleY, { align: "right" });
    }

    // Reset and return content start Y
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return titleY + 8;
  }

  // No company info — just title
  let y = 16;
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 7;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185);
  doc.text(title, MARGIN, y);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(subtitle, pageW - MARGIN, y, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

// ─── Standardized page footer ───
export function addPageFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, pageH - 9);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 9, { align: "right" });
  }
}

// ─── Info grid helper (label-value pairs) ───
export function drawInfoGrid(doc: jsPDF, rows: [string, string, string?, string?][], startY: number): number {
  let y = startY;
  doc.setFontSize(9);
  rows.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(row[0], 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(row[1], 50, y);
    if (row[2]) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(row[2], 115, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(row[3] || "—", 152, y);
    }
    y += 5;
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
