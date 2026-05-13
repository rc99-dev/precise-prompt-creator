import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatDateTime } from "./helpers";

const COMPANY = "Point do Açaí D'Amazônia";
const BRAND: [number, number, number] = [92, 27, 67];
const WHITE: [number, number, number] = [255, 255, 255];

export interface ReportSection {
  title: string;
  periodLabel: string;
  columns: string[];
  rows: (string | number)[][];
  /** Optional footer line (e.g., totals) */
  footer?: string;
}

export interface ReportBundle {
  title: string;
  periodLabel: string;
  sections: ReportSection[];
}

function safeFile(name: string) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sectionToAOA(section: ReportSection): (string | number)[][] {
  const rows: (string | number)[][] = [
    [section.title],
    [`Período: ${section.periodLabel}`],
    [],
    section.columns,
    ...section.rows.map((r) => r.map((c) => (c == null ? "" : c))),
  ];
  if (section.footer) rows.push([], [section.footer]);
  return rows;
}

export function exportSectionExcel(section: ReportSection) {
  const wb = XLSX.utils.book_new();
  const aoa = [
    [COMPANY],
    ...sectionToAOA(section),
    [],
    [`Gerado em: ${formatDateTime(new Date().toISOString())}`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = section.columns.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${safeFile(section.title)}_${Date.now()}.xlsx`);
}

export function exportBundleExcel(bundle: ReportBundle) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  bundle.sections.forEach((sec, idx) => {
    const aoa = [
      [COMPANY],
      [bundle.title],
      [`Período: ${bundle.periodLabel}`],
      [`Gerado em: ${formatDateTime(new Date().toISOString())}`],
      [],
      ...sectionToAOA(sec),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sec.columns.map(() => ({ wch: 22 }));
    let name = safeFile(sec.title).slice(0, 28) || `Sec${idx + 1}`;
    let n = name; let i = 2;
    while (used.has(n)) { n = `${name.slice(0, 26)}_${i++}`; }
    used.add(n);
    XLSX.utils.book_append_sheet(wb, ws, n);
  });
  XLSX.writeFile(wb, `${safeFile(bundle.title)}_${Date.now()}.xlsx`);
}

function drawHeader(doc: jsPDF, title: string, periodLabel: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 32, "F");
  try {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 4, 14, 14, 2, 2, "F");
    doc.addImage("/logo.png", "PNG", 10.5, 4.5, 13, 13);
  } catch { /* no logo */ }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(COMPANY, 28, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Compras - Relatório", 28, 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, w - 14, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Período: ${periodLabel}`, w - 14, 19, { align: "right" });
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, w - 14, 25, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function renderSection(doc: jsPDF, section: ReportSection, startY: number, repeatTitle: string, repeatPeriod: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text(section.title, 10, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: startY + 3,
    head: [section.columns],
    body: section.rows.length
      ? section.rows.map((r) => r.map((c) => (c == null ? "" : String(c))))
      : [["Sem dados", ...section.columns.slice(1).map(() => "")]],
    headStyles: { fillColor: BRAND, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 244, 246] },
    margin: { left: 10, right: 10, top: 38 },
    didDrawPage: () => drawHeader(doc, repeatTitle, repeatPeriod),
  });
  let y = (doc as any).lastAutoTable?.finalY || startY + 10;
  if (section.footer) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(section.footer, 10, y + 6);
    y += 6;
  }
  return y;
}

export function exportSectionPDF(section: ReportSection) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawHeader(doc, section.title, section.periodLabel);
  renderSection(doc, section, 40, section.title, section.periodLabel);
  doc.save(`${safeFile(section.title)}_${Date.now()}.pdf`);
}

export function exportBundlePDF(bundle: ReportBundle) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawHeader(doc, bundle.title, bundle.periodLabel);
  let y = 40;
  const pageH = doc.internal.pageSize.getHeight();
  bundle.sections.forEach((sec, idx) => {
    if (idx > 0 && y > pageH - 60) {
      doc.addPage();
      drawHeader(doc, bundle.title, bundle.periodLabel);
      y = 40;
    }
    y = renderSection(doc, sec, y + (idx === 0 ? 0 : 8), bundle.title, bundle.periodLabel);
  });
  doc.save(`${safeFile(bundle.title)}_${Date.now()}.pdf`);
}
