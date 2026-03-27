import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./helpers";

const COMPANY = "Point do Açaí D'Amazônia";
const PURPLE = [107, 78, 255] as const; // primary brand
const DARK = [30, 27, 45] as const;
const GRAY_LIGHT = [240, 238, 250] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [34, 197, 94] as const;

function drawHeader(doc: jsPDF, docType: string, numero: string, date: string) {
  const w = doc.internal.pageSize.getWidth();
  // Purple bar
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, w, 38, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(COMPANY, 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Compras", 14, 24);

  // Doc type badge
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(docType, w - 14, 16, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(numero, w - 14, 24, { align: "right" });
  doc.text(`Emissão: ${date}`, w - 14, 32, { align: "right" });

  // Separator line
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(14, 42, w - 14, 42);
}

function drawFooterLine(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, h - 20, w - 14, h - 20);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(COMPANY + " — Documento gerado automaticamente", 14, h - 14);
  doc.text(`Página ${(doc as any).getCurrentPageInfo?.()?.pageNumber || ""}`, w - 14, h - 14, { align: "right" });
}

interface SupplierInfo {
  razao_social: string;
  cnpj?: string | null;
  telefone?: string | null;
  cidade?: string | null;
}

interface OrderPDFItem {
  codigo?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface OrderPDFData {
  numero: string;
  created_at: string;
  observacoes?: string | null;
  total: number;
  supplier?: SupplierInfo | null;
  items: OrderPDFItem[];
  comprador?: string;
  aprovador?: string | null;
  approved_at?: string | null;
}

export function generateOrderPDF(data: OrderPDFData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  drawHeader(doc, "ORDEM DE COMPRA", data.numero, formatDate(data.created_at));

  let y = 48;

  // Supplier block
  if (data.supplier) {
    doc.setFillColor(...GRAY_LIGHT);
    doc.roundedRect(14, y, w - 28, 24, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("FORNECEDOR", 18, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.supplier.razao_social, 18, y + 12);
    const info: string[] = [];
    if (data.supplier.cnpj) info.push(`CNPJ: ${data.supplier.cnpj}`);
    if (data.supplier.telefone) info.push(`Tel: ${data.supplier.telefone}`);
    if (data.supplier.cidade) info.push(data.supplier.cidade);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(info.join("  •  "), 18, y + 18);
    y += 30;
  }

  // Items table
  const tableBody = data.items.map((item, idx) => [
    String(idx + 1),
    item.codigo || "—",
    item.descricao,
    item.unidade,
    String(item.quantidade),
    formatCurrency(item.preco_unitario),
    formatCurrency(item.subtotal),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Código", "Descrição", "Unidade", "Qtd", "Preço Unit.", "Subtotal"]],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK as any },
    headStyles: {
      fillColor: PURPLE as any,
      textColor: WHITE as any,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 246, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
    didDrawPage: () => {
      drawFooterLine(doc);
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Total row
  doc.setFillColor(...DARK);
  doc.roundedRect(w - 80, y, 66, 10, 1.5, 1.5, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("TOTAL:", w - 76, y + 7);
  doc.text(formatCurrency(data.total), w - 18, y + 7, { align: "right" });

  y += 18;

  // Observations
  if (data.observacoes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("OBSERVAÇÕES", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.observacoes, w - 28);
    doc.text(lines, 14, y + 5);
    y += 5 + lines.length * 4;
  }

  y += 6;

  // Footer info
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  if (data.comprador) {
    doc.setFont("helvetica", "normal");
    doc.text(`Comprador: ${data.comprador}`, 14, y);
    doc.text(`Data: ${formatDate(data.created_at)}`, 14, y + 5);
    y += 12;
  }
  if (data.aprovador && data.approved_at) {
    doc.text(`Aprovador: ${data.aprovador}`, 14, y);
    doc.text(`Data de aprovação: ${formatDate(data.approved_at)}`, 14, y + 5);
    y += 16;
  }

  // Signature lines
  const sigY = Math.max(y + 10, doc.internal.pageSize.getHeight() - 50);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);

  const sigW = 70;
  const sig1X = w / 2 - sigW - 10;
  const sig2X = w / 2 + 10;

  doc.line(sig1X, sigY, sig1X + sigW, sigY);
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Comprador", sig1X + sigW / 2, sigY + 4, { align: "center" });

  doc.line(sig2X, sigY, sig2X + sigW, sigY);
  doc.text("Aprovador", sig2X + sigW / 2, sigY + 4, { align: "center" });

  doc.save(`${data.numero}.pdf`);
}

// ===== QUOTATION PDF =====

interface QuotPDFItem {
  product_name: string;
  unidade: string;
  quantidade: number;
  prices: Record<string, number | null>; // supplier_id -> price
}

interface QuotPDFData {
  numero: string;
  created_at: string;
  estrategia: string;
  total: number;
  items: QuotPDFItem[];
  suppliers: { id: string; razao_social: string }[];
  supplierTotals: Record<string, number>;
  bestSupplierId?: string | null;
  comprador?: string;
}

export function generateQuotationPDF(data: QuotPDFData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  drawHeader(doc, "COTAÇÃO", data.numero, formatDate(data.created_at));

  let y = 48;

  // Strategy block
  const stratLabel = data.estrategia === "melhor_preco" ? "Melhor Preço por Item" : "Melhor Fornecedor Único";
  doc.setFillColor(...GRAY_LIGHT);
  doc.roundedRect(14, y, w - 28, 16, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("ESTRATÉGIA", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(stratLabel, 60, y + 6);

  if (data.bestSupplierId) {
    const winner = data.suppliers.find(s => s.id === data.bestSupplierId);
    doc.setFont("helvetica", "bold");
    doc.text(`Fornecedor ganhador: ${winner?.razao_social || "—"}`, 18, y + 12);
    doc.text(`Total: ${formatCurrency(data.total)}`, w - 18, y + 12, { align: "right" });
  }

  y += 22;

  // Comparative table
  const head = ["#", "Produto", "Unidade", "Qtd"];
  data.suppliers.forEach(s => head.push(s.razao_social));

  const body: (string | { content: string; styles?: any })[][] = [];

  data.items.forEach((item, idx) => {
    const prices = data.suppliers.map(s => item.prices[s.id] ?? null);
    const validPrices = prices.filter(p => p !== null) as number[];
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

    const row: (string | { content: string; styles?: any })[] = [
      String(idx + 1),
      item.product_name,
      item.unidade,
      String(item.quantidade),
    ];

    prices.forEach(p => {
      if (p === null) {
        row.push({ content: "—", styles: { textColor: [180, 180, 180] } });
      } else if (p === minPrice) {
        row.push({
          content: formatCurrency(p),
          styles: { textColor: GREEN as any, fontStyle: "bold" },
        });
      } else {
        row.push(formatCurrency(p));
      }
    });

    body.push(row);
  });

  // Totals row
  const totalRow: (string | { content: string; styles?: any })[] = ["", "TOTAL", "", ""];
  const totals = data.suppliers.map(s => data.supplierTotals[s.id] || 0);
  const minTotal = Math.min(...totals.filter(t => t > 0));
  data.suppliers.forEach(s => {
    const t = data.supplierTotals[s.id] || 0;
    if (t === minTotal && t > 0) {
      totalRow.push({
        content: formatCurrency(t),
        styles: { textColor: GREEN as any, fontStyle: "bold", fillColor: [230, 255, 230] },
      });
    } else {
      totalRow.push(t > 0 ? formatCurrency(t) : "—");
    }
  });
  body.push(totalRow);

  const supplierColWidth = Math.min(36, (w - 28 - 80) / data.suppliers.length);

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7, cellPadding: 2, textColor: DARK as any, overflow: "linebreak" },
    headStyles: {
      fillColor: PURPLE as any,
      textColor: WHITE as any,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 246, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
    },
    didDrawPage: () => { drawFooterLine(doc); },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  if (data.comprador) {
    doc.text(`Comprador: ${data.comprador}`, 14, y);
    doc.text(`Data: ${formatDate(data.created_at)}`, 14, y + 5);
  }

  doc.save(`${data.numero}.pdf`);
}
