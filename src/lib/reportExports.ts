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

function safeFile(name: string) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function exportSectionExcel(section: ReportSection) {
  const wb = XLSX.utils.book_new();
  const headerRows = [
    [COMPANY],
    [section.title],
    [`Período: ${section.periodLabel}`],
    [`Gerado em: ${formatDateTime(new Date().toISOString())}`],
    [],
    section.columns,
    ...section.rows.map((r) => r.map((c) => (c == null ? "" : c))),
  ];
  if (section.footer) headerRows.push([], [section.footer]);
  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  ws["!cols"] = section.columns.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${safeFile(section.title)}_${Date.now()}.xlsx`);
}

function drawHeader(doc: jsPDF, section: ReportSection) {
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
  doc.text(section.title, w - 14, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Período: ${section.periodLabel}`, w - 14, 19, { align: "right" });
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, w - 14, 25, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

export function exportSectionPDF(section: ReportSection) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawHeader(doc, section);
  autoTable(doc, {
    startY: 38,
    head: [section.columns],
    body: section.rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
    headStyles: { fillColor: BRAND, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 244, 246] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => drawHeader(doc, section),
  });
  if (section.footer) {
    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(section.footer, 10, finalY + 8);
  }
  doc.save(`${safeFile(section.title)}_${Date.now()}.pdf`);
}
