import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import {
  addReportHeader, addPageFooter, fetchCompanyInfo, type CompanyInfo,
  fmtCurrency as fmt, fmtQty as fmtNum, fmtPct,
  loadImage,
} from "./pdfHeader";

// Re-export for backward compatibility
export { fetchCompanyInfo, type CompanyInfo };

// ── Constants ──
const MARGIN = 14;
const PAGE_TOP = 15;

/** Get usable page height minus bottom margin */
function getMaxY(doc: jsPDF) {
  return doc.internal.pageSize.getHeight() - 20;
}

/** Ensure enough space for next section, otherwise add page */
function ensureSpace(doc: jsPDF, currentY: number, needed: number): number {
  if (currentY + needed > getMaxY(doc)) {
    doc.addPage();
    return PAGE_TOP;
  }
  return currentY;
}

/** Common autoTable margin config */
const TABLE_MARGIN = { left: MARGIN, right: MARGIN, top: PAGE_TOP, bottom: 20 };

// ── Fetch company info from the linked company (companies table) or fall back to company_settings ──
async function getReportCompanyInfo(data: ReportData): Promise<CompanyInfo | null> {
  if (data.company?.id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("*")
      .eq("id", data.company.id)
      .maybeSingle();
    if (comp) {
      return {
        company_name: comp.name || comp.trade_name || null,
        document: comp.document || null,
        logo_url: comp.logo_url || null,
        address: [comp.address, comp.address_number, comp.neighborhood].filter(Boolean).join(", ") || null,
        city: comp.city || null,
        state: comp.state || null,
        phone: comp.phone || comp.cellphone || null,
        email: comp.email || null,
      };
    }
  }
  return fetchCompanyInfo(data.userId);
}

// ─── Types ───
interface BudgetItem {
  id: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  sort_order: number | null;
  bdi?: number | null;
}

interface ReportData {
  budget: any;
  items: BudgetItem[];
  obra?: any;
  client?: any;
  company?: any;
  measurements?: any[];
  allMeasurementItems?: any[];
  planPeriods?: any[];
  planItems?: any[];
  userId: string;
}

function getPhases(items: BudgetItem[]) {
  const phases = [...new Set(items.map((i) => i.category || "Sem fase"))];
  return phases.sort();
}

function buildSubtitle(budgetCode?: string, obraName?: string): string | undefined {
  const parts: string[] = [];
  if (budgetCode) parts.push(`Cód: ${budgetCode}`);
  if (obraName) parts.push(`Obra: ${obraName}`);
  return parts.length > 0 ? parts.join("  |  ") : undefined;
}

const getPrefix = (desc: string) => {
  const m = desc.trim().match(/^(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
};

function getServiceAndPhaseItems(items: BudgetItem[]) {
  const phaseItems = items.filter((i) => (i.category || "").toLowerCase() === "fase");
  const serviceItems = items.filter((i) => ["serviço", "servico"].includes((i.category || "").toLowerCase()));
  const rootPhases = phaseItems.filter((p) => {
    const pfx = getPrefix(p.description);
    return pfx && !pfx.includes(".");
  }).sort((a, b) => parseInt(getPrefix(a.description)!) - parseInt(getPrefix(b.description)!));
  return { phaseItems, serviceItems, rootPhases };
}

function getBudgetPhaseGroups(items: BudgetItem[]) {
  const { rootPhases, serviceItems } = getServiceAndPhaseItems(items);

  const numericPhaseGroups = rootPhases.map((phase) => {
    const rootIdx = getPrefix(phase.description)!;
    const children = serviceItems.filter((service) => {
      const servicePrefix = getPrefix(service.description);
      return servicePrefix ? servicePrefix.split(".")[0] === rootIdx : false;
    });

    return {
      key: `numeric-${rootIdx}`,
      label: phase.description,
      items: children,
    };
  }).filter((group) => group.items.length > 0);

  const consumedIds = new Set(numericPhaseGroups.flatMap((group) => group.items.map((item) => item.id)));

  const phaseCategoryNames = [...new Set(
    items
      .map((item) => (item.category || "").trim())
      .filter((category) => {
        const normalized = category.toLowerCase();
        return !!category && !["fase", "serviço", "servico"].includes(normalized);
      })
  )];

  const namedPhaseGroups = phaseCategoryNames.map((phaseName) => ({
    key: `named-${phaseName}`,
    label: phaseName,
    items: items.filter((item) => !consumedIds.has(item.id) && (item.category || "").trim() === phaseName),
  })).filter((group) => group.items.length > 0);

  const uncategorizedItems = items.filter((item) => !consumedIds.has(item.id) && (item.category || "").toLowerCase() !== "fase");

  const fallbackGroups = uncategorizedItems.length > 0 ? [{
    key: "all-items",
    label: numericPhaseGroups.length > 0 || namedPhaseGroups.length > 0 ? "Itens sem fase vinculada" : "Itens do orçamento",
    items: uncategorizedItems,
  }] : [];

  return [...numericPhaseGroups, ...namedPhaseGroups, ...fallbackGroups];
}

// ─── 1. Orçamento de custo ───
async function reportOrcamentoCusto(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  let startY = await addReportHeader(doc, ci, "Orçamento de Custo", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const phaseGroups = getBudgetPhaseGroups(data.items);

  for (const phase of phaseGroups) {
    const phaseTotal = phase.items.reduce((s, i) => s + (i.total_price || 0), 0);

    startY = ensureSpace(doc, startY, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text(`${phase.label}  —  ${fmt(phaseTotal)}`, MARGIN, startY);
    doc.setTextColor(0, 0, 0);
    startY += 2;

    autoTable(doc, {
      startY,
      margin: TABLE_MARGIN,
      head: [["#", "Descrição", "Unid.", "Qtd.", "Preço Unit.", "Total"]],
      body: phase.items.map((i, idx) => [
        String(idx + 1), i.description, i.unit || "un",
        fmtNum(i.quantity), fmt(i.unit_price), fmt(i.total_price),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      foot: [["", "", "", "", "SUBTOTAL:", fmt(phaseTotal)]],
      footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
    });
    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  const total = phaseGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + (item.total_price || 0), 0), 0);
  startY = ensureSpace(doc, startY, 10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL GERAL: ${fmt(total)}`, MARGIN, startY + 2);

  addPageFooter(doc);
  doc.save(`Orcamento_Custo_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 2. Orçamento de venda ───
async function reportOrcamentoVenda(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  let startY = await addReportHeader(doc, ci, "Orçamento de Venda", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const bdiDefault = 0;
  const phaseGroups = getBudgetPhaseGroups(data.items);

  for (const phase of phaseGroups) {
    const phaseTotal = phase.items.reduce((s, i) => {
      const bdi = i.bdi ?? bdiDefault;
      return s + (i.unit_price || 0) * (1 + bdi / 100) * (i.quantity || 0);
    }, 0);

    startY = ensureSpace(doc, startY, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(39, 174, 96);
    doc.text(`${phase.label}  —  ${fmt(phaseTotal)}`, MARGIN, startY);
    doc.setTextColor(0, 0, 0);
    startY += 2;

    autoTable(doc, {
      startY,
      margin: TABLE_MARGIN,
      head: [["#", "Descrição", "Unid.", "Qtd.", "Preço Unit.", "BDI %", "Preço c/ BDI", "Total"]],
      body: phase.items.map((i, idx) => {
        const bdi = i.bdi ?? bdiDefault;
        const priceWithBdi = (i.unit_price || 0) * (1 + bdi / 100);
        const totalWithBdi = priceWithBdi * (i.quantity || 0);
        return [
          String(idx + 1), i.description, i.unit || "un", fmtNum(i.quantity),
          fmt(i.unit_price), `${fmtNum(bdi)}%`, fmt(priceWithBdi), fmt(totalWithBdi),
        ];
      }),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 250, 245] },
      foot: [["", "", "", "", "", "", "SUBTOTAL:", fmt(phaseTotal)]],
      footStyles: { fillColor: [230, 250, 230], fontStyle: "bold" },
    });
    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  const totalVenda = phaseGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => {
    const bdi = item.bdi ?? bdiDefault;
    return groupSum + (item.unit_price || 0) * (1 + bdi / 100) * (item.quantity || 0);
  }, 0), 0);

  startY = ensureSpace(doc, startY, 10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL VENDA: ${fmt(totalVenda)}`, MARGIN, startY + 2);

  addPageFooter(doc);
  doc.save(`Orcamento_Venda_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 3. Relatórios de planejamento ───
async function reportPlanejamento(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  let startY = await addReportHeader(doc, ci, "Planejamento Físico-Econômico", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const periods = data.planPeriods || [];
  const pItems = data.planItems || [];

  if (periods.length === 0) {
    doc.setFontSize(10);
    doc.text("Nenhum período de planejamento cadastrado.", MARGIN, startY);
    addPageFooter(doc);
    doc.save(`Planejamento_${data.budget.budget_code || data.budget.id}.pdf`);
    return;
  }

  const getVendaTotal = (item: BudgetItem) => {
    const bdi = item.bdi ?? 0;
    return (item.unit_price || 0) * (1 + bdi / 100) * (item.quantity || 0);
  };

  const phaseData = getBudgetPhaseGroups(data.items).map((phase, index) => {
    const total = phase.items.reduce((sum, item) => sum + getVendaTotal(item), 0);
    return { rootIdx: String(index + 1), label: phase.label, total, services: phase.items };
  }).filter((p) => p.services.length > 0);

  const periodHeaders = periods.map((p: any) => p.period_label || new Date(p.period_date).toLocaleDateString("pt-BR"));
  const head = ["Serviço", "Total Venda (R$)", ...periodHeaders, "Acum. (R$)", "Saldo (R$)"];

  for (const phase of phaseData) {
    const phasePeriodTotals: number[] = periods.map((period: any) => {
      return phase.services.reduce((sum, svc) => {
        const pi = pItems.find((x: any) => x.budget_item_id === svc.id && x.plan_period_id === period.id);
        const pct = pi?.planned_percentage || 0;
        return sum + getVendaTotal(svc) * (pct / 100);
      }, 0);
    });
    const phaseAccum = phasePeriodTotals.reduce((s, v) => s + v, 0);
    const phaseSaldo = phase.total - phaseAccum;

    startY = ensureSpace(doc, startY, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(142, 68, 173);
    doc.text(`${phase.label}  —  Total: ${fmt(phase.total)}  |  Planejado: ${fmt(phaseAccum)}  |  Saldo: ${fmt(phaseSaldo)}`, MARGIN, startY);
    doc.setTextColor(0, 0, 0);
    startY += 2;

    const body = phase.services.map((svc) => {
      const vendaTotal = getVendaTotal(svc);
      const row: string[] = [svc.description, fmt(vendaTotal)];
      let accum = 0;
      for (const period of periods) {
        const pi = pItems.find((x: any) => x.budget_item_id === svc.id && x.plan_period_id === period.id);
        const pct = pi?.planned_percentage || 0;
        const value = vendaTotal * (pct / 100);
        accum += value;
        row.push(fmt(value));
      }
      row.push(fmt(accum));
      row.push(fmt(vendaTotal - accum));
      return row;
    });

    const subtotalRow: string[] = ["SUBTOTAL", fmt(phase.total)];
    for (let i = 0; i < phasePeriodTotals.length; i++) {
      subtotalRow.push(fmt(phasePeriodTotals[i]));
    }
    subtotalRow.push(fmt(phaseAccum));
    subtotalRow.push(fmt(phaseSaldo));

    autoTable(doc, {
      startY,
      margin: TABLE_MARGIN,
      head: [head],
      body,
      foot: [subtotalRow],
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [142, 68, 173], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [230, 220, 240], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 245, 250] },
    });
    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  const grandTotal = phaseData.reduce((s, p) => s + p.total, 0);
  const grandAccum = phaseData.reduce((s, p) => {
    return s + p.services.reduce((ss, svc) => {
      const vendaTotal = getVendaTotal(svc);
      const accPct = pItems
        .filter((x: any) => x.budget_item_id === svc.id)
        .reduce((a: number, x: any) => a + (x.planned_percentage || 0), 0);
      return ss + vendaTotal * (accPct / 100);
    }, 0);
  }, 0);

  startY = ensureSpace(doc, startY, 10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL GERAL: ${fmt(grandTotal)}  |  Planejado: ${fmt(grandAccum)}  |  Saldo: ${fmt(grandTotal - grandAccum)}`, MARGIN, startY + 2);

  addPageFooter(doc);
  doc.save(`Planejamento_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 4. Previsto x Realizado - Custo ───
async function reportPrevistoRealizadoCusto(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  const y = await addReportHeader(doc, ci, "Previsto x Realizado — Custo", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const phases = getPhases(data.items);
  const allMI = data.allMeasurementItems || [];

  const body = phases.map((phase) => {
    const phaseItems = data.items.filter((i) => (i.category || "Sem fase") === phase);
    const orcado = phaseItems.reduce((s, i) => s + (i.total_price || 0), 0);
    let realizado = 0;
    phaseItems.forEach((item) => {
      const accPct = allMI.filter((mi: any) => mi.budget_item_id === item.id)
        .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
      realizado += (item.total_price || 0) * (accPct / 100);
    });
    const desvio = realizado - orcado;
    const pctExec = orcado > 0 ? (realizado / orcado) * 100 : 0;
    return [phase, fmt(orcado), fmt(realizado), fmt(desvio), fmtPct(pctExec)];
  });

  const totalOrc = data.items.reduce((s, i) => s + (i.total_price || 0), 0);
  let totalReal = 0;
  data.items.forEach((item) => {
    const accPct = allMI.filter((mi: any) => mi.budget_item_id === item.id)
      .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
    totalReal += (item.total_price || 0) * (accPct / 100);
  });

  autoTable(doc, {
    startY: y,
    margin: TABLE_MARGIN,
    head: [["Fase", "Orçado (R$)", "Realizado (R$)", "Desvio (R$)", "% Execução"]],
    body,
    foot: [["TOTAL", fmt(totalOrc), fmt(totalReal), fmt(totalReal - totalOrc), fmtPct(totalOrc > 0 ? (totalReal / totalOrc) * 100 : 0)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  addPageFooter(doc);
  doc.save(`Previsto_Realizado_Custo_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 5. Previsto x Realizado de Insumos ───
async function reportPrevistoRealizadoInsumos(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  let startY = await addReportHeader(doc, ci, "Previsto x Realizado — Insumos", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const allMI = data.allMeasurementItems || [];
  const phases = getPhases(data.items);

  for (const phase of phases) {
    const phaseItems = data.items.filter((i) => (i.category || "Sem fase") === phase);
    const phasePrevisto = phaseItems.reduce((s, i) => s + (i.quantity || 0), 0);
    let phaseRealizado = 0;
    phaseItems.forEach((item) => {
      const accPct = allMI.filter((mi: any) => mi.budget_item_id === item.id)
        .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
      phaseRealizado += (item.quantity || 0) * (accPct / 100);
    });

    startY = ensureSpace(doc, startY, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(230, 126, 34);
    doc.text(`${phase}  —  Prev: ${fmtNum(phasePrevisto)}  |  Real: ${fmtNum(phaseRealizado)}  |  Saldo: ${fmtNum(phasePrevisto - phaseRealizado)}`, MARGIN, startY);
    doc.setTextColor(0, 0, 0);
    startY += 2;

    const body = phaseItems.map((item) => {
      const previsto = item.quantity || 0;
      const accPct = allMI.filter((mi: any) => mi.budget_item_id === item.id)
        .reduce((a: number, mi: any) => a + (mi.measured_percentage || 0), 0);
      const realizado = previsto * (accPct / 100);
      const saldo = previsto - realizado;
      return [
        item.description, item.unit || "un", fmtNum(previsto), fmtNum(realizado),
        fmtNum(saldo), fmtPct(previsto > 0 ? (realizado / previsto) * 100 : 0),
      ];
    });

    autoTable(doc, {
      startY,
      margin: TABLE_MARGIN,
      head: [["Insumo/Serviço", "Unid.", "Previsto", "Realizado", "Saldo", "% Exec."]],
      body,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [230, 126, 34], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 248, 240] },
    });
    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  addPageFooter(doc);
  doc.save(`Previsto_Realizado_Insumos_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 6. Curva ABC ───
async function reportCurvaABC(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  let startY = await addReportHeader(doc, ci, "Curva ABC", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const total = data.items.reduce((s, i) => s + (i.total_price || 0), 0);
  const phases = getPhases(data.items);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(192, 57, 43);
  doc.text("Resumo por Fase", MARGIN, startY);
  doc.setTextColor(0, 0, 0);
  startY += 2;

  const phaseSummary = phases.map((phase) => {
    const phaseItems = data.items.filter((i) => (i.category || "Sem fase") === phase);
    const phaseTotal = phaseItems.reduce((s, i) => s + (i.total_price || 0), 0);
    const pct = total > 0 ? (phaseTotal / total) * 100 : 0;
    return [phase, String(phaseItems.length), fmt(phaseTotal), fmtPct(pct)];
  });

  autoTable(doc, {
    startY,
    margin: TABLE_MARGIN,
    head: [["Fase", "Itens", "Valor Total", "% do Total"]],
    body: phaseSummary,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 245, 245] },
  });
  startY = (doc as any).lastAutoTable.finalY + 6;

  const sorted = [...data.items].sort((a, b) => (b.total_price || 0) - (a.total_price || 0));
  let accumulated = 0;
  const body = sorted.map((item, idx) => {
    const pct = total > 0 ? ((item.total_price || 0) / total) * 100 : 0;
    accumulated += pct;
    const cls = accumulated <= 80 ? "A" : accumulated <= 95 ? "B" : "C";
    return [
      String(idx + 1), item.description, item.category || "—", item.unit || "un",
      fmtNum(item.quantity), fmt(item.total_price), fmtPct(pct), fmtPct(accumulated), cls,
    ];
  });

  autoTable(doc, {
    startY,
    margin: TABLE_MARGIN,
    head: [["#", "Descrição", "Fase", "Unid.", "Qtd.", "Total (R$)", "% Ind.", "% Acum.", "Classe"]],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && hookData.column.index === 8) {
        const val = hookData.cell.raw;
        if (val === "A") hookData.cell.styles.fillColor = [46, 204, 113];
        else if (val === "B") hookData.cell.styles.fillColor = [241, 196, 15];
        else hookData.cell.styles.fillColor = [231, 76, 60];
        hookData.cell.styles.textColor = 255;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  addPageFooter(doc);
  doc.save(`Curva_ABC_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 7. Formulário de orçamento ───
async function reportFormularioOrcamento(data: ReportData) {
  const doc = new jsPDF();
  const ci = await getReportCompanyInfo(data);
  let cy = await addReportHeader(doc, ci, "Formulário de Orçamento", buildSubtitle(data.budget.budget_code, data.obra?.name));

  cy += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const infoLines = [
    [`Código: ${data.budget.budget_code || "—"}`, `Status: ${data.budget.status || "—"}`],
    [`Obra: ${data.obra?.name || "—"}`, `Cliente: ${data.client?.name || "—"}`],
    [`Empresa: ${data.company?.name || "—"}`, `Descrição: ${data.budget.description || "—"}`],
    [`Data criação: ${new Date(data.budget.created_at).toLocaleDateString("pt-BR")}`, `Valor total: ${fmt(data.budget.total_value)}`],
  ];
  for (const [l, r] of infoLines) {
    doc.text(l, MARGIN, cy);
    doc.text(r, 110, cy);
    cy += 5;
  }
  cy += 3;

  const phases = getPhases(data.items);

  for (const phase of phases) {
    const phaseItems = data.items.filter((i) => (i.category || "Sem fase") === phase);
    const phaseTotal = phaseItems.reduce((s, i) => s + (i.total_price || 0), 0);

    cy = ensureSpace(doc, cy, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(41, 128, 185);
    doc.text(`${phase}  —  ${fmt(phaseTotal)}`, MARGIN, cy);
    doc.setTextColor(0, 0, 0);
    cy += 2;

    autoTable(doc, {
      startY: cy,
      margin: TABLE_MARGIN,
      head: [["#", "Descrição", "Unid.", "Qtd.", "Preço Unit.", "Total"]],
      body: phaseItems.map((i, idx) => [
        String(idx + 1), i.description, i.unit || "un",
        fmtNum(i.quantity), fmt(i.unit_price), fmt(i.total_price),
      ]),
      foot: [["", "", "", "", "SUBTOTAL:", fmt(phaseTotal)]],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    cy = (doc as any).lastAutoTable.finalY + 6;
  }

  const total = data.items.reduce((s, i) => s + (i.total_price || 0), 0);
  cy = ensureSpace(doc, cy, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL GERAL: ${fmt(total)}`, MARGIN, cy + 2);

  const fy = cy + 22;
  doc.setDrawColor(100);
  doc.line(MARGIN, fy, 85, fy);
  doc.line(120, fy, 195, fy);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Responsável técnico", 30, fy + 4);
  doc.text("Cliente / Contratante", 140, fy + 4);

  addPageFooter(doc);
  doc.save(`Formulario_Orcamento_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 8. Prestação de serviço ───
async function reportPrestacaoServico(data: ReportData) {
  const doc = new jsPDF();
  const ci = await getReportCompanyInfo(data);
  let cy = await addReportHeader(doc, ci, "Prestação de Serviço", buildSubtitle(data.budget.budget_code, data.obra?.name));

  cy += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Contratante: ${data.client?.name || "—"}`, MARGIN, cy); cy += 5;
  doc.text(`Obra: ${data.obra?.name || "—"}`, MARGIN, cy); cy += 5;
  doc.text(`Empresa: ${data.company?.name || "—"}`, MARGIN, cy); cy += 5;
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, MARGIN, cy); cy += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Serviços contratados:", MARGIN, cy); cy += 4;

  const serviceItems = data.items.filter((i) => (i.category || "").toLowerCase().includes("servi"));
  const itemsToShow = serviceItems.length > 0 ? serviceItems : data.items;

  autoTable(doc, {
    startY: cy,
    margin: TABLE_MARGIN,
    head: [["#", "Descrição", "Unid.", "Qtd.", "Preço Unit.", "Total"]],
    body: itemsToShow.map((i, idx) => [
      String(idx + 1), i.description, i.unit || "un",
      fmtNum(i.quantity), fmt(i.unit_price), fmt(i.total_price),
    ]),
    foot: [["", "", "", "", "TOTAL:", fmt(itemsToShow.reduce((s, i) => s + (i.total_price || 0), 0))]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const tableEnd = (doc as any).lastAutoTable.finalY;
  let fy = tableEnd + 25;
  fy = ensureSpace(doc, fy, 15) === PAGE_TOP ? PAGE_TOP + 10 : fy;
  doc.setDrawColor(100);
  doc.line(MARGIN, fy, 85, fy);
  doc.line(120, fy, 195, fy);
  doc.setFontSize(8);
  doc.text("Contratada", 40, fy + 4);
  doc.text("Contratante", 150, fy + 4);

  addPageFooter(doc);
  doc.save(`Prestacao_Servico_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 9. Proposta comercial ───
async function reportPropostaComercial(data: ReportData) {
  const doc = new jsPDF();
  const ci = await getReportCompanyInfo(data);
  let cy = await addReportHeader(doc, ci, "Proposta Comercial", buildSubtitle(data.budget.budget_code, data.obra?.name));

  cy += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`A/C: ${data.client?.name || "—"}`, MARGIN, cy); cy += 5;
  doc.text(`Ref.: ${data.obra?.name || "—"}`, MARGIN, cy); cy += 5;
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, MARGIN, cy); cy += 8;

  doc.text("Prezado(a) cliente,", MARGIN, cy); cy += 5;
  doc.text("Apresentamos a seguir nossa proposta para os serviços e materiais abaixo discriminados:", MARGIN, cy); cy += 8;

  const totalVenda = data.items.reduce((s, i) => {
    const bdi = i.bdi ?? 0;
    return s + (i.unit_price || 0) * (1 + bdi / 100) * (i.quantity || 0);
  }, 0);

  autoTable(doc, {
    startY: cy,
    margin: TABLE_MARGIN,
    head: [["Item", "Descrição", "Unid.", "Qtd.", "Valor Unit.", "Total"]],
    body: data.items.map((i, idx) => {
      const bdi = i.bdi ?? 0;
      const price = (i.unit_price || 0) * (1 + bdi / 100);
      return [
        String(idx + 1), i.description, i.unit || "un",
        fmtNum(i.quantity), fmt(price), fmt(price * (i.quantity || 0)),
      ];
    }),
    foot: [["", "", "", "", "TOTAL:", fmt(totalVenda)]],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [230, 250, 230], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  let fy = (doc as any).lastAutoTable.finalY + 8;
  fy = ensureSpace(doc, fy, 35) === PAGE_TOP ? PAGE_TOP + 5 : fy;
  doc.setFontSize(8);
  doc.text("Condições de pagamento: A combinar.", MARGIN, fy);
  doc.text("Prazo de validade da proposta: 30 dias.", MARGIN, fy + 4);
  doc.text("Atenciosamente,", MARGIN, fy + 12);

  const sy = fy + 25;
  doc.setDrawColor(100);
  doc.line(MARGIN, sy, 85, sy);
  doc.setFontSize(8);
  doc.text(ci?.company_name || "Empresa", 30, sy + 4);

  addPageFooter(doc);
  doc.save(`Proposta_Comercial_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── 10. Histograma de recursos ───
async function reportHistogramaRecursos(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ci = await getReportCompanyInfo(data);
  const y = await addReportHeader(doc, ci, "Histograma de Recursos", buildSubtitle(data.budget.budget_code, data.obra?.name));

  const byUnit: Record<string, { items: BudgetItem[]; totalQty: number; totalValue: number }> = {};
  for (const item of data.items) {
    const unit = item.unit || "un";
    if (!byUnit[unit]) byUnit[unit] = { items: [], totalQty: 0, totalValue: 0 };
    byUnit[unit].items.push(item);
    byUnit[unit].totalQty += item.quantity || 0;
    byUnit[unit].totalValue += item.total_price || 0;
  }

  const body = Object.entries(byUnit).map(([unit, info]) => [
    unit,
    String(info.items.length),
    fmtNum(info.totalQty),
    fmt(info.totalValue),
    info.items.map((i) => i.description).slice(0, 5).join(", ") + (info.items.length > 5 ? "..." : ""),
  ]);

  autoTable(doc, {
    startY: y,
    margin: TABLE_MARGIN,
    head: [["Recurso (Unid.)", "Itens", "Qtd. Total", "Valor Total", "Principais itens"]],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 245, 250] },
    columnStyles: { 4: { cellWidth: 100 } },
  });

  let fy = (doc as any).lastAutoTable.finalY + 8;
  fy = ensureSpace(doc, fy, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(155, 89, 182);
  doc.text("Distribuição por Fase", MARGIN, fy);
  doc.setTextColor(0, 0, 0);

  const phases = getPhases(data.items);
  const phaseBody = phases.map((phase) => {
    const phaseItems = data.items.filter((i) => (i.category || "Sem fase") === phase);
    return [
      phase,
      String(phaseItems.length),
      fmtNum(phaseItems.reduce((s, i) => s + (i.quantity || 0), 0)),
      fmt(phaseItems.reduce((s, i) => s + (i.total_price || 0), 0)),
    ];
  });

  autoTable(doc, {
    startY: fy + 3,
    margin: TABLE_MARGIN,
    head: [["Fase", "Itens", "Qtd. Total", "Valor Total"]],
    body: phaseBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 245, 250] },
  });

  addPageFooter(doc);
  doc.save(`Histograma_Recursos_${data.budget.budget_code || data.budget.id}.pdf`);
}

// ─── Dispatch ───
export async function generateBudgetReport(reportName: string, data: ReportData) {
  const handlers: Record<string, (d: ReportData) => Promise<void>> = {
    "Orçamento de custo": reportOrcamentoCusto,
    "Orçamento de venda": reportOrcamentoVenda,
    "Relatórios de planejamento": reportPlanejamento,
    "Previsto x Realizado - Custo": reportPrevistoRealizadoCusto,
    "Previsto x Realizado de Insumos": reportPrevistoRealizadoInsumos,
    "Curva ABC": reportCurvaABC,
    "Formulário de orçamento": reportFormularioOrcamento,
    "Prestação de serviço": reportPrestacaoServico,
    "Proposta comercial": reportPropostaComercial,
    "Histograma de recursos": reportHistogramaRecursos,
  };

  const handler = handlers[reportName];
  if (!handler) {
    throw new Error(`Relatório "${reportName}" não encontrado.`);
  }
  await handler(data);
}
