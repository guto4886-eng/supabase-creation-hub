import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface CompanyInfo {
  company_name?: string | null;
  document?: string | null;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ExportField {
  name: string;
  label: string;
}

export async function fetchCompanyInfo(userId: string): Promise<CompanyInfo | null> {
  const { data } = await supabase
    .from("company_settings" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as unknown as CompanyInfo | null;
}

function getDisplayValue(item: Record<string, any>, fieldName: string): string {
  const val = item[fieldName];
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  return String(val);
}

function buildAddressLine(c: CompanyInfo): string {
  const parts: string[] = [];
  if (c.address) parts.push(c.address);
  if (c.city) parts.push(c.city);
  if (c.state) parts.push(c.state);
  return parts.join(" - ");
}

// ── CSV ──
export function exportCSV(
  data: Record<string, any>[],
  fields: ExportField[],
  filename: string,
  company: CompanyInfo | null
) {
  const lines: string[] = [];

  if (company) {
    if (company.company_name) lines.push(company.company_name);
    if (company.document) lines.push(`CNPJ/CPF: ${company.document}`);
    const addr = buildAddressLine(company);
    if (addr) lines.push(addr);
    if (company.phone) lines.push(`Tel: ${company.phone}`);
    if (company.email) lines.push(company.email);
    lines.push(""); // blank line
  }

  const headers = fields.map((f) => f.label);
  lines.push(headers.join(","));

  data.forEach((item) => {
    const row = fields.map((f) => {
      const str = getDisplayValue(item, f.name);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(row.join(","));
  });

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

// ── Excel ──
export function exportExcel(
  data: Record<string, any>[],
  fields: ExportField[],
  filename: string,
  company: CompanyInfo | null
) {
  const rows: any[][] = [];

  if (company) {
    if (company.company_name) rows.push([company.company_name]);
    if (company.document) rows.push([`CNPJ/CPF: ${company.document}`]);
    const addr = buildAddressLine(company);
    if (addr) rows.push([addr]);
    if (company.phone) rows.push([`Tel: ${company.phone}`]);
    if (company.email) rows.push([company.email]);
    rows.push([]); // blank row
  }

  rows.push(fields.map((f) => f.label));
  data.forEach((item) => {
    rows.push(fields.map((f) => getDisplayValue(item, f.name)));
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF ──
export async function exportPDF(
  data: Record<string, any>[],
  fields: ExportField[],
  filename: string,
  company: CompanyInfo | null
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let startY = 15;

  if (company) {
    // Try to load logo
    if (company.logo_url) {
      try {
        const img = await loadImage(company.logo_url);
        doc.addImage(img, "JPEG", 14, 10, 25, 25);
        startY = 12;
      } catch {
        // skip logo
      }
    }

    const textX = company.logo_url ? 44 : 14;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (company.company_name) {
      doc.text(company.company_name, textX, startY);
      startY += 6;
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (company.document) {
      doc.text(`CNPJ/CPF: ${company.document}`, textX, startY);
      startY += 4;
    }
    const addr = buildAddressLine(company);
    if (addr) {
      doc.text(addr, textX, startY);
      startY += 4;
    }
    if (company.phone) {
      doc.text(`Tel: ${company.phone}`, textX, startY);
      startY += 4;
    }
    if (company.email) {
      doc.text(company.email, textX, startY);
      startY += 4;
    }
    startY += 4;
  }

  const head = [fields.map((f) => f.label)];
  const body = data.map((item) => fields.map((f) => getDisplayValue(item, f.name)));

  autoTable(doc, {
    startY,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}.pdf`);
}

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

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
