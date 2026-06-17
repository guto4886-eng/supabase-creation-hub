// Central de Custos — Geradores de relatórios PDF premium (A4 vertical).
// Stack: jsPDF + jspdf-autotable. Charts são vetoriais (SVG via path) para nitidez de impressão.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { phaseColor, phaseIcon, formatBRL, DEFAULT_PHASES, type Phase } from "./ccTags";

type Entry = {
  id: string;
  obra_id: string;
  tipo: string;
  nome_item: string;
  categoria: string | null;
  tags: string[];
  fase?: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  data: string;
  forma_pagamento: string | null;
  fornecedor: string | null;
  funcionario_id: string | null;
  observacao: string | null;
};

type Employee = { id: string; nome: string; funcao: string | null; valor_diaria: number | null; valor_mensal: number | null };

export type ReportContext = {
  obraName: string;
  obraInicio?: string | null;
  orcamentoPrevisto: number;
  gastoTotal: number;
  entries: Entry[];
  employees?: Employee[];
  phases?: Phase[];
  periodoLabel?: string;
  /** Distribuição percentual do orçamento por fase (ex.: { "Fundação": 20, "Acabamento": 35 }).
   *  Quando vazio, o relatório aplica rateio proporcional automático. */
  orcamentoPorFase?: Record<string, number>;
};

// ============ Paleta institucional ============
const NAVY: [number, number, number] = [30, 58, 138];        // #1e3a8a
const NAVY_DARK: [number, number, number] = [17, 39, 102];
const AMBER: [number, number, number] = [245, 158, 11];      // #f59e0b
const INK: [number, number, number] = [17, 24, 39];          // #111827
const MUTED: [number, number, number] = [107, 114, 128];     // #6b7280
const LIGHT: [number, number, number] = [243, 244, 246];     // #f3f4f6
const BORDER: [number, number, number] = [229, 231, 235];    // #e5e7eb
const SUCCESS: [number, number, number] = [16, 185, 129];
const WARN: [number, number, number] = [245, 158, 11];
const DANGER: [number, number, number] = [239, 68, 68];

const PIE_COLORS: [number, number, number][] = [
  [99, 102, 241], [16, 185, 129], [245, 158, 11], [239, 68, 68],
  [6, 182, 212], [139, 92, 246], [236, 72, 153], [132, 204, 22],
  [14, 165, 233], [249, 115, 22], [20, 184, 166], [168, 85, 247],
];

const A4_W = 210;
const A4_H = 297;
const MARGIN = 14;
const CONTENT_W = A4_W - MARGIN * 2;

// ============ Setup helpers ============
function setFill(doc: jsPDF, c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]); }
function setStroke(doc: jsPDF, c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]); }
function setText(doc: jsPDF, c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]); }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const MESES_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function formatMonthYear(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MESES_PT[idx]}/${y}`;
}

// Calcula o "mês de referência" do relatório a partir dos lançamentos.
function getReferenciaMes(ctx: ReportContext): string {
  // Se o usuário definiu um período explícito (e não é "Todos os lançamentos"), usa-o.
  if (ctx.periodoLabel && ctx.periodoLabel !== "Todos os lançamentos") return ctx.periodoLabel;
  const months = new Set<string>();
  ctx.entries.forEach((e) => {
    const k = (e.data || "").slice(0, 7);
    if (k) months.add(k);
  });
  const sorted = Array.from(months).sort();
  if (sorted.length === 0) return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (sorted.length === 1) return formatMonthYear(sorted[0]);
  return `${formatMonthYear(sorted[0])} a ${formatMonthYear(sorted[sorted.length - 1])}`;
}


// ============ Capa ============
function drawCover(doc: jsPDF, ctx: ReportContext, reportTitle: string) {
  // Fundo branco já é padrão. Faixa diagonal navy decorativa.
  setFill(doc, NAVY);
  doc.rect(0, 0, A4_W, 90, "F");

  // Bloco amber decorativo
  setFill(doc, AMBER);
  doc.rect(0, 90, A4_W, 4, "F");

  // Logo placeholder (círculo branco + sigla)
  setFill(doc, [255, 255, 255]);
  doc.circle(MARGIN + 10, 28, 9, "F");
  setText(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TO", MARGIN + 10, 30.5, { align: "center" });

  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOCA A OBRA", MARGIN + 24, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Central de Custos · Relatório Executivo", MARGIN + 24, 30);

  // Título grande
  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(reportTitle, CONTENT_W);
  doc.text(titleLines, MARGIN, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(ctx.obraName, MARGIN, 60 + titleLines.length * 11);

  // Faixa de referência (mês/ano) — destaque executivo
  const referencia = getReferenciaMes(ctx);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, AMBER);
  doc.text(`Levantamento referente a: ${referencia}`, MARGIN, 60 + titleLines.length * 11 + 7);

  // Bloco de metadados
  const blockY = 120;
  setFill(doc, LIGHT);
  doc.roundedRect(MARGIN, blockY, CONTENT_W, 70, 3, 3, "F");

  const items: Array<[string, string]> = [
    ["Obra", ctx.obraName],
    ["Início da obra", ctx.obraInicio ? new Date(ctx.obraInicio + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
    ["Mês de referência", referencia],
    ["Total de lançamentos", String(ctx.entries.length)],
    ["Emitido em", new Date().toLocaleString("pt-BR")],
    ["Tipo do relatório", reportTitle],
  ];
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 6 + col * (CONTENT_W / 2);
    const y = blockY + 10 + row * 18;
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(it[0].toUpperCase(), x, y);
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const val = doc.splitTextToSize(it[1], CONTENT_W / 2 - 12);
    doc.text(val[0] || "—", x, y + 5);
  });

  // KPIs principais (cards)
  const kY = 205;
  const kpis = [
    { label: "Orçamento Previsto", value: formatBRL(ctx.orcamentoPrevisto), color: NAVY },
    { label: "Gasto Total", value: formatBRL(ctx.gastoTotal), color: AMBER },
    { label: "Saldo", value: formatBRL(ctx.orcamentoPrevisto - ctx.gastoTotal),
      color: ctx.orcamentoPrevisto - ctx.gastoTotal >= 0 ? SUCCESS : DANGER },
  ];
  const cardW = (CONTENT_W - 8) / 3;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + 4);
    setFill(doc, [255, 255, 255]);
    setStroke(doc, BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, kY, cardW, 30, 2.5, 2.5, "FD");
    setFill(doc, k.color);
    doc.rect(x, kY, 3, 30, "F");
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(k.label.toUpperCase(), x + 8, kY + 9);
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(k.value, x + 8, kY + 19);
  });

  // Rodapé da capa
  setText(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Documento gerado automaticamente pelo sistema Toca a Obra · uso interno.",
    A4_W / 2, A4_H - 14, { align: "center" });
}

// ============ Header e footer de páginas internas ============
function drawPageChrome(doc: jsPDF, ctx: ReportContext, reportTitle: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);

    // Header
    setFill(doc, NAVY);
    doc.rect(0, 0, A4_W, 14, "F");
    setText(doc, [255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TOCA A OBRA", MARGIN, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const center = `${reportTitle} · ${ctx.obraName} · Ref.: ${getReferenciaMes(ctx)}`;
    doc.text(center, A4_W / 2, 9, { align: "center" });
    doc.text(new Date().toLocaleDateString("pt-BR"), A4_W - MARGIN, 9, { align: "right" });

    // Footer
    setStroke(doc, BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, A4_H - 12, A4_W - MARGIN, A4_H - 12);
    setText(doc, MUTED);
    doc.setFontSize(7.5);
    doc.text("Gerado por Toca a Obra · " + new Date().toLocaleString("pt-BR"),
      MARGIN, A4_H - 7);
    doc.text(`Página ${i} de ${pageCount}`, A4_W - MARGIN, A4_H - 7, { align: "right" });
  }
}

// ============ Helpers de layout ============
function ensureSpace(doc: jsPDF, currentY: number, needed: number, ctx: ReportContext, reportTitle: string): number {
  if (currentY + needed > A4_H - 18) {
    doc.addPage();
    return 24;
  }
  return currentY;
}

function sectionTitle(doc: jsPDF, y: number, title: string, subtitle?: string): number {
  setText(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, MARGIN, y);
  if (subtitle) {
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(subtitle, MARGIN, y + 4.5);
  }
  setFill(doc, AMBER);
  doc.rect(MARGIN, y + (subtitle ? 7 : 3), 18, 0.8, "F");
  return y + (subtitle ? 13 : 9);
}

function kpiRow(doc: jsPDF, y: number, items: Array<{ label: string; value: string; tone?: [number, number, number] }>): number {
  const n = items.length;
  const cardW = (CONTENT_W - (n - 1) * 3) / n;
  items.forEach((it, i) => {
    const x = MARGIN + i * (cardW + 3);
    setFill(doc, [255, 255, 255]);
    setStroke(doc, BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "FD");
    setFill(doc, it.tone || NAVY);
    doc.rect(x, y, 2.5, 22, "F");
    setText(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(it.label.toUpperCase(), x + 6, y + 7);
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(it.value, x + 6, y + 16);
  });
  return y + 26;
}

// ============ Charts vetoriais ============
function drawDonut(
  doc: jsPDF,
  cx: number, cy: number, rOuter: number, rInner: number,
  data: Array<{ label: string; value: number; color: [number, number, number] }>,
) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    setStroke(doc, BORDER);
    doc.setLineWidth(0.8);
    doc.circle(cx, cy, rOuter, "S");
    setText(doc, MUTED);
    doc.setFontSize(8);
    doc.text("Sem dados", cx, cy + 1, { align: "center" });
    return;
  }
  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const slice = (d.value / total) * Math.PI * 2;
    drawDonutSlice(doc, cx, cy, rOuter, rInner, startAngle, startAngle + slice, d.color);
    startAngle += slice;
  });
  // Total no centro
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatBRL(total), cx, cy, { align: "center" });
  setText(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Total", cx, cy + 4, { align: "center" });
}

function drawDonutSlice(
  doc: jsPDF,
  cx: number, cy: number, rO: number, rI: number,
  a0: number, a1: number, color: [number, number, number],
) {
  const steps = Math.max(8, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 64));
  setFill(doc, color);
  // Aproximação por triângulos finos a partir do centro do anel
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + ((a1 - a0) * i) / steps;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    const x1 = cx + Math.cos(t0) * rO, y1 = cy + Math.sin(t0) * rO;
    const x2 = cx + Math.cos(t1) * rO, y2 = cy + Math.sin(t1) * rO;
    const x3 = cx + Math.cos(t1) * rI, y3 = cy + Math.sin(t1) * rI;
    const x4 = cx + Math.cos(t0) * rI, y4 = cy + Math.sin(t0) * rI;
    doc.triangle(x1, y1, x2, y2, x3, y3, "F");
    doc.triangle(x1, y1, x3, y3, x4, y4, "F");
  }
}

function drawLegend(
  doc: jsPDF, x: number, y: number, maxW: number,
  items: Array<{ label: string; value: number; color: [number, number, number]; pct?: number }>,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let cy = y;
  items.forEach((it) => {
    setFill(doc, it.color);
    doc.roundedRect(x, cy - 2.5, 3, 3, 0.5, 0.5, "F");
    setText(doc, INK);
    const labelMax = maxW - 50;
    const labelLines = doc.splitTextToSize(it.label, labelMax);
    doc.text(labelLines[0] || "—", x + 5, cy);
    setText(doc, MUTED);
    const right = `${formatBRL(it.value)}${it.pct != null ? ` (${it.pct.toFixed(1)}%)` : ""}`;
    doc.text(right, x + maxW, cy, { align: "right" });
    cy += 5;
  });
  setText(doc, INK);
  return cy;
}

function drawBarsHorizontal(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  items: Array<{ label: string; value: number; color?: [number, number, number] }>,
) {
  if (items.length === 0) {
    setText(doc, MUTED);
    doc.setFontSize(8);
    doc.text("Sem dados", x + w / 2, y + h / 2, { align: "center" });
    return;
  }
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const barH = Math.min(8, (h - 4) / items.length - 2);
  const labelW = 50;
  items.forEach((it, i) => {
    const by = y + i * (barH + 3);
    setText(doc, INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const labelLines = doc.splitTextToSize(it.label, labelW - 2);
    doc.text(labelLines[0] || "—", x, by + barH * 0.7);
    const bw = ((w - labelW - 30) * it.value) / max;
    setFill(doc, it.color || NAVY);
    doc.roundedRect(x + labelW, by, Math.max(0.5, bw), barH, 1, 1, "F");
    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(formatBRL(it.value), x + w, by + barH * 0.7, { align: "right" });
  });
}

function drawLineChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  points: Array<{ label: string; value: number }>,
  color: [number, number, number] = NAVY,
) {
  setStroke(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
  if (points.length === 0) {
    setText(doc, MUTED);
    doc.setFontSize(8);
    doc.text("Sem dados", x + w / 2, y + h / 2, { align: "center" });
    return;
  }
  const padL = 18, padR = 4, padT = 6, padB = 12;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = 0;
  // grade
  setStroke(doc, BORDER);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = y + padT + (innerH * i) / 4;
    doc.line(x + padL, gy, x + padL + innerW, gy);
    setText(doc, MUTED);
    doc.setFontSize(6);
    const v = max - (max - min) * (i / 4);
    doc.text(`${(v / 1000).toFixed(0)}k`, x + padL - 2, gy + 1.5, { align: "right" });
  }
  // linha
  setStroke(doc, color);
  doc.setLineWidth(0.8);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = x + padL + i * stepX;
    const y1 = y + padT + innerH - ((points[i].value - min) / (max - min || 1)) * innerH;
    const x2 = x + padL + (i + 1) * stepX;
    const y2 = y + padT + innerH - ((points[i + 1].value - min) / (max - min || 1)) * innerH;
    doc.line(x1, y1, x2, y2);
  }
  // pontos
  setFill(doc, color);
  points.forEach((p, i) => {
    const px = x + padL + i * stepX;
    const py = y + padT + innerH - ((p.value - min) / (max - min || 1)) * innerH;
    doc.circle(px, py, 0.9, "F");
  });
  // labels eixo X (até 6 visíveis)
  setText(doc, MUTED);
  doc.setFontSize(6.5);
  const stepLabel = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((p, i) => {
    if (i % stepLabel === 0 || i === points.length - 1) {
      const px = x + padL + i * stepX;
      doc.text(p.label, px, y + h - 3, { align: "center" });
    }
  });
}

function drawGauge(doc: jsPDF, cx: number, cy: number, r: number, pct: number) {
  // Arco de fundo
  const start = Math.PI, end = 2 * Math.PI;
  setStroke(doc, BORDER);
  doc.setLineWidth(4);
  drawArc(doc, cx, cy, r, start, end);
  // Cor pela saúde
  const color: [number, number, number] = pct >= 90 ? DANGER : pct >= 70 ? WARN : SUCCESS;
  setStroke(doc, color);
  drawArc(doc, cx, cy, r, start, start + (end - start) * Math.min(1, pct / 100));
  // Texto central
  setText(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${pct.toFixed(0)}%`, cx, cy - 1, { align: "center" });
  setText(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(pct >= 90 ? "RISCO" : pct >= 70 ? "ATENÇÃO" : "SAUDÁVEL", cx, cy + 5, { align: "center" });
}

function drawArc(doc: jsPDF, cx: number, cy: number, r: number, a0: number, a1: number) {
  const steps = Math.max(8, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 64));
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + ((a1 - a0) * i) / steps;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    const x1 = cx + Math.cos(t0) * r, y1 = cy + Math.sin(t0) * r;
    const x2 = cx + Math.cos(t1) * r, y2 = cy + Math.sin(t1) * r;
    doc.line(x1, y1, x2, y2);
  }
}

// ============ Agrupamentos ============
function groupByMonth(entries: Entry[]): Array<{ label: string; value: number }> {
  const map: Record<string, number> = {};
  entries.forEach((e) => {
    const key = (e.data || "").slice(0, 7);
    if (!key) return;
    map[key] = (map[key] || 0) + Number(e.valor_total || 0);
  });
  return Object.keys(map).sort().map((k) => {
    const [y, m] = k.split("-");
    return { label: `${m}/${y.slice(2)}`, value: map[k] };
  });
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  arr.forEach((it) => {
    const k = keyFn(it) || "—";
    (out[k] = out[k] || []).push(it);
  });
  return out;
}

function autoInsightsByPhase(entries: Entry[], orcamentoPrevisto: number): string[] {
  const byPhase = groupBy(entries, (e) => e.fase || "Sem fase");
  const totals = Object.entries(byPhase).map(([nome, list]) => ({ nome, total: list.reduce((s, e) => s + Number(e.valor_total || 0), 0) }));
  totals.sort((a, b) => b.total - a.total);
  const out: string[] = [];
  if (orcamentoPrevisto > 0 && totals[0]) {
    const pct = (totals[0].total / orcamentoPrevisto) * 100;
    if (pct >= 50) out.push(`[ATENCAO] ${totals[0].nome} ja consumiu ${pct.toFixed(0)}% do orcamento previsto.`);
  }
  // crescimento mensal por fase top1
  if (totals[0]) {
    const list = byPhase[totals[0].nome];
    const monthly: Record<string, number> = {};
    list.forEach((e) => {
      const k = (e.data || "").slice(0, 7);
      monthly[k] = (monthly[k] || 0) + Number(e.valor_total || 0);
    });
    const keys = Object.keys(monthly).sort();
    if (keys.length >= 2) {
      const prev = monthly[keys[keys.length - 2]];
      const cur = monthly[keys[keys.length - 1]];
      if (prev > 0) {
        const g = ((cur - prev) / prev) * 100;
        if (g >= 20) out.push(`[ALERTA] Custos de ${totals[0].nome} cresceram ${g.toFixed(0)}% no ultimo mes.`);
      }
    }
  }
  // fase com menor gasto
  const last = totals[totals.length - 1];
  if (last && totals.length >= 3) out.push(`[OK] ${last.nome} e a fase com menor gasto ate o momento.`);
  if (out.length === 0) out.push("[INFO] Sem alertas relevantes no periodo.");
  return out;
}

function drawInsights(doc: jsPDF, y: number, items: string[]): number {
  items.forEach((t) => {
    setFill(doc, LIGHT);
    setStroke(doc, BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 9, 2, 2, "FD");
    setText(doc, INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(t, CONTENT_W - 6);
    doc.text(lines[0] || "", MARGIN + 3, y + 6);
    y += 11;
  });
  return y;
}

// ============ Configuração padrão de autoTable ============
function tableTheme() {
  return {
    styles: { fontSize: 8.5, cellPadding: 3, textColor: INK, lineColor: BORDER, lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] as [number, number, number] },
    margin: { left: MARGIN, right: MARGIN },
  };
}

// ============ Finalização ============
function save(doc: jsPDF, ctx: ReportContext, reportTitle: string, filename: string) {
  drawPageChrome(doc, ctx, reportTitle);
  doc.save(filename);
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ============ Relatórios ============

// 1. Resumo Financeiro
export async function gerarResumoFinanceiro(ctx: ReportContext) {
  const title = "Resumo Financeiro";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);

  doc.addPage();
  let y = 24;
  const saldo = ctx.orcamentoPrevisto - ctx.gastoTotal;
  const pct = ctx.orcamentoPrevisto > 0 ? (ctx.gastoTotal / ctx.orcamentoPrevisto) * 100 : 0;
  const margem = ctx.orcamentoPrevisto > 0 ? (saldo / ctx.orcamentoPrevisto) * 100 : 0;

  y = kpiRow(doc, y, [
    { label: "Orçamento Previsto", value: formatBRL(ctx.orcamentoPrevisto), tone: NAVY },
    { label: "Gasto Total", value: formatBRL(ctx.gastoTotal), tone: AMBER },
    { label: "Saldo", value: formatBRL(saldo), tone: saldo >= 0 ? SUCCESS : DANGER },
  ]);
  y = kpiRow(doc, y, [
    { label: "% Consumido", value: `${pct.toFixed(1)}%`, tone: pct >= 90 ? DANGER : pct >= 70 ? WARN : SUCCESS },
    { label: "Margem", value: `${margem.toFixed(1)}%`, tone: NAVY },
    { label: "Lançamentos", value: String(ctx.entries.length), tone: NAVY_DARK },
  ]);

  // Resumo executivo
  y = sectionTitle(doc, y + 2, "Resumo Executivo");
  const saudeTxt = pct >= 90 ? "em situação de risco financeiro" : pct >= 70 ? "em estado de atenção" : "com margem financeira saudável";
  const texto = ctx.orcamentoPrevisto > 0
    ? `A obra ${ctx.obraName} encontra-se com ${pct.toFixed(1)}% do orçamento consumido, ${saudeTxt}. Foram registrados ${ctx.entries.length} lançamentos totalizando ${formatBRL(ctx.gastoTotal)} de uma meta de ${formatBRL(ctx.orcamentoPrevisto)}. O saldo disponível é de ${formatBRL(saldo)}.`
    : `A obra ${ctx.obraName} ainda não possui orçamento previsto definido. Foram registrados ${ctx.entries.length} lançamentos totalizando ${formatBRL(ctx.gastoTotal)}. Defina o orçamento para habilitar análises de saldo e margem.`;
  setText(doc, INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(texto, CONTENT_W);
  doc.text(lines, MARGIN, y);
  y += lines.length * 4.5 + 4;

  // Evolução
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Evolução Financeira", "Total mensal de lançamentos");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 55, groupByMonth(ctx.entries));
  y += 60;

  // Distribuição por categoria + Gauge saúde lado a lado
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Distribuição de Custos", "Por categoria de despesa");
  const byCat: Record<string, number> = {};
  ctx.entries.forEach((e) => { byCat[e.tipo] = (byCat[e.tipo] || 0) + Number(e.valor_total || 0); });
  const catData = Object.entries(byCat).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  catData.sort((a, b) => b.value - a.value);
  drawDonut(doc, MARGIN + 30, y + 26, 22, 12, catData);
  const total = catData.reduce((s, d) => s + d.value, 0);
  drawLegend(doc, MARGIN + 65, y + 5, CONTENT_W - 65,
    catData.slice(0, 8).map((d) => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 })));
  y += 58;

  // Saúde
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Saúde Financeira da Obra");
  drawGauge(doc, MARGIN + 30, y + 22, 18, pct);
  setText(doc, INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const healthMsg = pct >= 90
    ? "Risco elevado de estouro orçamentário. Recomenda-se revisão urgente dos próximos lançamentos."
    : pct >= 70
    ? "Atenção: a obra atingiu mais de 70% do orçamento. Monitorar próximas despesas com cuidado."
    : "Obra dentro do orçamento previsto. Continue acompanhando os lançamentos.";
  const hLines = doc.splitTextToSize(healthMsg, CONTENT_W - 70);
  doc.text(hLines, MARGIN + 65, y + 15);
  y += 50;

  // Top Maiores Custos
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Top 10 Maiores Lançamentos");
  const top = [...ctx.entries].sort((a, b) => Number(b.valor_total) - Number(a.valor_total)).slice(0, 10);
  autoTable(doc, {
    startY: y,
    head: [["Item", "Categoria", "Fase", "Qtd", "Valor", "% do Total"]],
    body: top.map((e) => [
      e.nome_item,
      e.tipo,
      e.fase || "—",
      `${Number(e.quantidade || 0).toLocaleString("pt-BR")} ${e.unidade || ""}`.trim(),
      formatBRL(Number(e.valor_total)),
      ctx.gastoTotal > 0 ? `${((Number(e.valor_total) / ctx.gastoTotal) * 100).toFixed(1)}%` : "—",
    ]),
    ...tableTheme(),
  });

  save(doc, ctx, title, `resumo-financeiro-${slug(ctx.obraName)}.pdf`);
}

// 2. Custos por Categoria
export async function gerarCustosPorCategoria(ctx: ReportContext) {
  const title = "Custos por Categoria";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  const byCat: Record<string, { total: number; qtd: number }> = {};
  ctx.entries.forEach((e) => {
    const k = e.tipo;
    byCat[k] = byCat[k] || { total: 0, qtd: 0 };
    byCat[k].total += Number(e.valor_total || 0);
    byCat[k].qtd += 1;
  });
  const list = Object.entries(byCat)
    .map(([nome, v], i) => ({ nome, ...v, color: PIE_COLORS[i % PIE_COLORS.length] }))
    .sort((a, b) => b.total - a.total);
  const total = list.reduce((s, l) => s + l.total, 0);

  y = sectionTitle(doc, y, "Distribuição por Categoria");
  drawDonut(doc, MARGIN + 35, y + 30, 26, 14, list.map((l) => ({ label: l.nome, value: l.total, color: l.color })));
  drawLegend(doc, MARGIN + 75, y + 5, CONTENT_W - 75,
    list.map((l) => ({ label: l.nome, value: l.total, color: l.color, pct: total > 0 ? (l.total / total) * 100 : 0 })));
  y += 68;

  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Ranking por Categoria");
  drawBarsHorizontal(doc, MARGIN, y, CONTENT_W, 50, list.slice(0, 8).map((l) => ({ label: l.nome, value: l.total, color: l.color })));
  y += 55;

  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Evolução Mensal");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 50, groupByMonth(ctx.entries));
  y += 55;

  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Detalhamento");
  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Total Gasto", "Lançamentos", "% do Total", "Ticket Médio"]],
    body: list.map((l) => [
      l.nome,
      formatBRL(l.total),
      String(l.qtd),
      total > 0 ? `${((l.total / total) * 100).toFixed(1)}%` : "—",
      formatBRL(l.qtd > 0 ? l.total / l.qtd : 0),
    ]),
    ...tableTheme(),
  });

  save(doc, ctx, title, `custos-categoria-${slug(ctx.obraName)}.pdf`);
}

// 3. Custos por Fase
export async function gerarCustosPorFase(ctx: ReportContext) {
  const title = "Custos por Fase da Obra";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  const phases = ctx.phases || DEFAULT_PHASES;
  const byPhase: Record<string, { total: number; qtd: number }> = {};
  ctx.entries.forEach((e) => {
    const k = e.fase || "Sem fase";
    byPhase[k] = byPhase[k] || { total: 0, qtd: 0 };
    byPhase[k].total += Number(e.valor_total || 0);
    byPhase[k].qtd += 1;
  });
  const list = Object.entries(byPhase)
    .map(([nome, v]) => ({ nome, ...v, color: hexToRgb(phaseColor(nome === "Sem fase" ? null : nome, phases)) }))
    .sort((a, b) => b.total - a.total);
  const total = list.reduce((s, l) => s + l.total, 0);

  y = sectionTitle(doc, y, "Distribuição por Fase");
  drawDonut(doc, MARGIN + 35, y + 32, 28, 15, list.map((l) => ({ label: l.nome, value: l.total, color: l.color })));
  drawLegend(doc, MARGIN + 78, y + 5, CONTENT_W - 78,
    list.slice(0, 10).map((l) => ({ label: `${phaseIcon(l.nome === "Sem fase" ? null : l.nome, phases)} ${l.nome}`, value: l.total, color: l.color, pct: total > 0 ? (l.total / total) * 100 : 0 })));
  y += 72;

  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Ranking de Fases por Custo");
  drawBarsHorizontal(doc, MARGIN, y, CONTENT_W, 55, list.slice(0, 8).map((l) => ({ label: l.nome, value: l.total, color: l.color })));
  y += 60;

  // Evolução da fase top 1
  if (list[0]) {
    y = ensureSpace(doc, y, 60, ctx, title);
    y = sectionTitle(doc, y, `Evolução: ${list[0].nome}`, "Gasto mensal acumulado");
    const sub = ctx.entries.filter((e) => (e.fase || "Sem fase") === list[0].nome);
    drawLineChart(doc, MARGIN, y, CONTENT_W, 50, groupByMonth(sub), list[0].color);
    y += 55;
  }

  // Tabela detalhada
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Detalhamento por Fase");
  autoTable(doc, {
    startY: y,
    head: [["Fase", "Total", "% do Total", "Lançamentos", "Média / Lançamento"]],
    body: list.map((l) => [
      l.nome,
      formatBRL(l.total),
      total > 0 ? `${((l.total / total) * 100).toFixed(1)}%` : "—",
      String(l.qtd),
      formatBRL(l.qtd > 0 ? l.total / l.qtd : 0),
    ]),
    ...tableTheme(),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Alertas automáticos
  y = ensureSpace(doc, y, 50, ctx, title);
  y = sectionTitle(doc, y, "Alertas Automáticos");
  drawInsights(doc, y, autoInsightsByPhase(ctx.entries, ctx.orcamentoPrevisto));

  save(doc, ctx, title, `custos-fases-${slug(ctx.obraName)}.pdf`);
}

// 4. Materiais
export async function gerarMateriais(ctx: ReportContext) {
  const title = "Relatório de Materiais";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  // Agrupa por tag principal
  const materials = ctx.entries.filter((e) => e.tipo === "material");
  const byTag: Record<string, { qtd: number; total: number; lanc: number; fornecedores: Set<string>; unidades: Set<string> }> = {};
  materials.forEach((e) => {
    const tag = (e.tags && e.tags[0]) || e.nome_item.toLowerCase().split(" ")[0];
    byTag[tag] = byTag[tag] || { qtd: 0, total: 0, lanc: 0, fornecedores: new Set(), unidades: new Set() };
    byTag[tag].qtd += Number(e.quantidade || 0);
    byTag[tag].total += Number(e.valor_total || 0);
    byTag[tag].lanc += 1;
    if (e.fornecedor) byTag[tag].fornecedores.add(e.fornecedor);
    if (e.unidade) byTag[tag].unidades.add(e.unidade);
  });
  const list = Object.entries(byTag)
    .map(([tag, v], i) => ({ tag, ...v, color: PIE_COLORS[i % PIE_COLORS.length] }))
    .sort((a, b) => b.total - a.total);

  // Agrupa por item (nome) — quantidades acumuladas por unidade
  const byItem: Record<string, { nome: string; unidade: string; qtd: number; total: number; lanc: number; fornecedores: Set<string> }> = {};
  materials.forEach((e) => {
    const key = `${(e.nome_item || "—").trim().toUpperCase()}__${e.unidade || ""}`;
    byItem[key] = byItem[key] || { nome: (e.nome_item || "—").trim(), unidade: e.unidade || "", qtd: 0, total: 0, lanc: 0, fornecedores: new Set() };
    byItem[key].qtd += Number(e.quantidade || 0);
    byItem[key].total += Number(e.valor_total || 0);
    byItem[key].lanc += 1;
    if (e.fornecedor) byItem[key].fornecedores.add(e.fornecedor);
  });
  const itemList = Object.values(byItem).sort((a, b) => b.total - a.total);

  // KPIs
  const totalMat = list.reduce((s, l) => s + l.total, 0);
  y = kpiRow(doc, y, [
    { label: "Total em Materiais", value: formatBRL(totalMat), tone: NAVY },
    { label: "Itens Distintos", value: String(itemList.length), tone: AMBER },
    { label: "Lançamentos", value: String(materials.length), tone: NAVY_DARK },
  ]);

  // Top materiais (por item, com quantidade)
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Top Itens por Custo", "Quantidade acumulada e valor total");
  drawBarsHorizontal(doc, MARGIN, y, CONTENT_W, 60, itemList.slice(0, 10).map((l, i) => ({
    label: `${l.nome} — ${l.qtd.toLocaleString("pt-BR")} ${l.unidade}`.trim(),
    value: l.total,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })));
  y += 65;

  // Evolução mensal de materiais
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Evolução Mensal — Materiais");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 50, groupByMonth(materials));
  y += 55;

  // Detalhamento por item (com quantidade)
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Quantitativo por Item", "Ex.: Paver 260 m², Cimento 45 saco");
  autoTable(doc, {
    startY: y,
    head: [["Item", "Quantidade", "Unidade", "Total", "Preço Médio", "Lançamentos"]],
    body: itemList.map((l) => [
      l.nome,
      l.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      l.unidade || "—",
      formatBRL(l.total),
      formatBRL(l.qtd > 0 ? l.total / l.qtd : 0),
      String(l.lanc),
    ]),
    ...tableTheme(),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Tabela agrupada por tag
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Agrupamento por Tag");
  autoTable(doc, {
    startY: y,
    head: [["Tag", "Quantidade", "Unidades", "Total", "Lançamentos", "Fornecedores"]],
    body: list.map((l) => [
      `#${l.tag}`,
      l.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
      l.unidades.size > 0 ? Array.from(l.unidades).join(", ") : "—",
      formatBRL(l.total),
      String(l.lanc),
      l.fornecedores.size > 0 ? Array.from(l.fornecedores).slice(0, 3).join(", ") : "—",
    ]),
    ...tableTheme(),
  });

  save(doc, ctx, title, `materiais-${slug(ctx.obraName)}.pdf`);
}

// 5. Funcionários
export async function gerarFuncionarios(ctx: ReportContext) {
  const title = "Relatório de Funcionários";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  const emps = ctx.employees || [];
  const laborEntries = ctx.entries.filter((e) => e.tipo === "funcionario" || e.funcionario_id);
  const byEmp: Record<string, number> = {};
  laborEntries.forEach((e) => {
    const k = e.funcionario_id || e.nome_item;
    byEmp[k] = (byEmp[k] || 0) + Number(e.valor_total || 0);
  });
  const ranking = emps
    .map((emp) => ({ ...emp, total: byEmp[emp.id] || 0 }))
    .sort((a, b) => b.total - a.total);
  const folhaTotal = Object.values(byEmp).reduce((s, v) => s + v, 0);

  y = kpiRow(doc, y, [
    { label: "Folha Total", value: formatBRL(folhaTotal), tone: NAVY },
    { label: "Funcionários", value: String(emps.length), tone: AMBER },
    { label: "Lançamentos", value: String(laborEntries.length), tone: NAVY_DARK },
  ]);

  // Ranking por funcionário
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Ranking por Custo");
  drawBarsHorizontal(doc, MARGIN, y, CONTENT_W, 60,
    ranking.slice(0, 10).map((r, i) => ({ label: r.nome, value: r.total, color: PIE_COLORS[i % PIE_COLORS.length] })));
  y += 65;

  // Evolução
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Evolução Mensal — Mão de Obra");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 50, groupByMonth(laborEntries));
  y += 55;

  // Tabela
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Detalhamento");
  autoTable(doc, {
    startY: y,
    head: [["Funcionário", "Função", "Diária", "Mensal", "Total Gasto"]],
    body: ranking.map((r) => [
      r.nome,
      r.funcao || "—",
      r.valor_diaria != null ? formatBRL(r.valor_diaria) : "—",
      r.valor_mensal != null ? formatBRL(r.valor_mensal) : "—",
      formatBRL(r.total),
    ]),
    ...tableTheme(),
  });

  save(doc, ctx, title, `funcionarios-${slug(ctx.obraName)}.pdf`);
}

// 6. Evolução Financeira
export async function gerarEvolucao(ctx: ReportContext) {
  const title = "Evolução Financeira";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  const monthly = groupByMonth(ctx.entries);
  const acc: Array<{ label: string; value: number }> = [];
  let s = 0;
  monthly.forEach((p) => { s += p.value; acc.push({ label: p.label, value: s }); });

  // KPIs
  const totalMes = monthly.length > 0 ? monthly[monthly.length - 1].value : 0;
  const totalMesAnterior = monthly.length > 1 ? monthly[monthly.length - 2].value : 0;
  const crescimento = totalMesAnterior > 0 ? ((totalMes - totalMesAnterior) / totalMesAnterior) * 100 : 0;
  const mediaMensal = monthly.length > 0 ? ctx.gastoTotal / monthly.length : 0;
  y = kpiRow(doc, y, [
    { label: "Gasto no Mês", value: formatBRL(totalMes), tone: NAVY },
    { label: "Crescimento", value: `${crescimento >= 0 ? "+" : ""}${crescimento.toFixed(1)}%`,
      tone: crescimento > 0 ? WARN : SUCCESS },
    { label: "Média Mensal", value: formatBRL(mediaMensal), tone: NAVY_DARK },
  ]);

  // Linha principal
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Evolução Mensal", "Soma de lançamentos por mês");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 60, monthly);
  y += 65;

  // Acumulado
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Acumulado", "Gasto acumulado ao longo do tempo");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 60, acc, AMBER);
  y += 65;

  // Previsão simples
  y = ensureSpace(doc, y, 50, ctx, title);
  y = sectionTitle(doc, y, "Projeção de Custo Final");
  const previsao = ctx.gastoTotal + mediaMensal * 3;
  setText(doc, INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const txt = `Com base na média mensal de ${formatBRL(mediaMensal)} e ${monthly.length} meses de histórico, a projeção do custo final da obra (gasto atual + 3 meses na média) é de ${formatBRL(previsao)}.`;
  doc.text(doc.splitTextToSize(txt, CONTENT_W), MARGIN, y);
  y += 18;

  // Tabela mensal
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Detalhamento Mensal");
  autoTable(doc, {
    startY: y,
    head: [["Mês", "Gasto", "Acumulado", "% do Total"]],
    body: monthly.map((p, i) => [
      p.label,
      formatBRL(p.value),
      formatBRL(acc[i].value),
      ctx.gastoTotal > 0 ? `${((p.value / ctx.gastoTotal) * 100).toFixed(1)}%` : "—",
    ]),
    ...tableTheme(),
  });

  save(doc, ctx, title, `evolucao-${slug(ctx.obraName)}.pdf`);
}

// 7. Previsto x Realizado
export async function gerarPrevistoRealizado(ctx: ReportContext) {
  const title = "Previsto x Realizado";
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawCover(doc, ctx, title);
  doc.addPage();
  let y = 24;

  const saldo = ctx.orcamentoPrevisto - ctx.gastoTotal;
  const pct = ctx.orcamentoPrevisto > 0 ? (ctx.gastoTotal / ctx.orcamentoPrevisto) * 100 : 0;
  y = kpiRow(doc, y, [
    { label: "Previsto", value: formatBRL(ctx.orcamentoPrevisto), tone: NAVY },
    { label: "Realizado", value: formatBRL(ctx.gastoTotal), tone: AMBER },
    { label: "Diferença", value: formatBRL(saldo), tone: saldo >= 0 ? SUCCESS : DANGER },
  ]);

  // Comparativo de barras
  y = ensureSpace(doc, y, 70, ctx, title);
  y = sectionTitle(doc, y, "Comparativo Global");
  drawBarsHorizontal(doc, MARGIN, y, CONTENT_W, 30, [
    { label: "Previsto", value: ctx.orcamentoPrevisto, color: NAVY },
    { label: "Realizado", value: ctx.gastoTotal, color: AMBER },
  ]);
  y += 38;

  // Por fase
  y = ensureSpace(doc, y, 70, ctx, title);
  const distribuicao = ctx.orcamentoPorFase || {};
  const totalPct = Object.values(distribuicao).reduce((s, v) => s + Number(v || 0), 0);
  const usaDistribuicao = totalPct > 0 && ctx.orcamentoPrevisto > 0;
  y = sectionTitle(
    doc,
    y,
    "Comparativo por Fase",
    usaDistribuicao
      ? "Distribuição definida pelo usuário"
      : "Considerando rateio proporcional do orçamento"
  );
  const byPhase: Record<string, number> = {};
  ctx.entries.forEach((e) => {
    const k = e.fase || "Sem fase";
    byPhase[k] = (byPhase[k] || 0) + Number(e.valor_total || 0);
  });
  // União: fases com gastos + fases configuradas na distribuição
  const nomesFases = new Set<string>([...Object.keys(byPhase), ...Object.keys(distribuicao)]);
  const phaseList = Array.from(nomesFases)
    .map((nome) => ({ nome, total: byPhase[nome] || 0 }))
    .sort((a, b) => b.total - a.total);
  const phasePrevRateado = phaseList.length > 0 ? ctx.orcamentoPrevisto / phaseList.length : 0;
  const previstoDaFase = (nome: string) => {
    if (usaDistribuicao) {
      const pct = Number(distribuicao[nome] || 0);
      return (ctx.orcamentoPrevisto * pct) / 100;
    }
    return phasePrevRateado;
  };
  autoTable(doc, {
    startY: y,
    head: [["Fase", usaDistribuicao ? "Previsto (definido)" : "Previsto (rateado)", "Realizado", "Diferença", "% Consumido", "Status"]],
    body: phaseList.map((p) => {
      const prev = previstoDaFase(p.nome);
      const dif = prev - p.total;
      const pctP = prev > 0 ? (p.total / prev) * 100 : 0;
      const status = prev <= 0 ? "Sem previsto" : pctP >= 100 ? "Estourou" : pctP >= 80 ? "Proximo" : "OK";
      return [
        p.nome,
        formatBRL(prev),
        formatBRL(p.total),
        formatBRL(dif),
        prev > 0 ? `${pctP.toFixed(1)}%` : "—",
        status,
      ];
    }),
    ...tableTheme(),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Evolução comparada (linha)
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Evolução do Gasto", "Linha do realizado vs meta linear");
  drawLineChart(doc, MARGIN, y, CONTENT_W, 50, groupByMonth(ctx.entries));
  y += 55;

  // Saúde
  y = ensureSpace(doc, y, 60, ctx, title);
  y = sectionTitle(doc, y, "Saúde da Execução");
  drawGauge(doc, MARGIN + 30, y + 22, 18, pct);

  save(doc, ctx, title, `previsto-realizado-${slug(ctx.obraName)}.pdf`);
}
