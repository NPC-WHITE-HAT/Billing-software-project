import { jsPDF } from "jspdf";

export interface InvoicePdfData {
  businessName: string;
  businessCategory?: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  gstin?: string | null;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxRate: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  items: {
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

export function generateInvoicePdfBuffer(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header: Business Name & Tax Invoice Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.businessName || "Retail Store", 15, y);

  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246); // Blue
  doc.text("TAX INVOICE", pageWidth - 15, y, { align: "right" });

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 5;
  if (data.businessCategory) {
    doc.text(data.businessCategory, 15, y);
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.invoiceNumber, pageWidth - 15, y, { align: "right" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  if (data.businessAddress) {
    doc.text(data.businessAddress, 15, y);
  }
  doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString("en-IN")}`, pageWidth - 15, y, {
    align: "right",
  });

  y += 5;
  if (data.businessPhone) {
    doc.text(`Ph: ${data.businessPhone}`, 15, y);
  }
  if (data.gstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${data.gstin}`, 15, y + 5);
    y += 5;
  }

  y += 8;
  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(15, y, pageWidth - 15, y);

  // Customer & Payment Info
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("BILLED TO:", 15, y);
  doc.text("PAYMENT INFO:", pageWidth - 70, y);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.customerName || "Walk-in Customer", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Method: ${data.paymentMethod.toUpperCase()}`, pageWidth - 70, y);

  y += 4;
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, 15, y);
  }
  doc.text(`Status: ${data.paymentStatus.toUpperCase()}`, pageWidth - 70, y);

  y += 8;
  // Items Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, pageWidth - 30, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text("Item Description", 18, y + 5.5);
  doc.text("SKU", 85, y + 5.5);
  doc.text("Qty", 125, y + 5.5, { align: "center" });
  doc.text("Price (INR)", 155, y + 5.5, { align: "right" });
  doc.text("Total (INR)", pageWidth - 18, y + 5.5, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);

  data.items.forEach((item) => {
    y += 6;
    doc.text(item.productName.slice(0, 32), 18, y);
    doc.text(item.sku.slice(0, 16), 85, y);
    doc.text(String(item.quantity), 125, y, { align: "center" });
    doc.text(item.unitPrice.toFixed(2), 155, y, { align: "right" });
    doc.text(item.totalPrice.toFixed(2), pageWidth - 18, y, { align: "right" });
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 2, pageWidth - 15, y + 2);
  });

  y += 10;
  // Summary Section
  const rightX = pageWidth - 18;
  const labelX = pageWidth - 65;

  doc.text("Subtotal:", labelX, y);
  doc.text(`INR ${data.subtotal.toFixed(2)}`, rightX, y, { align: "right" });

  if (data.discountAmount > 0) {
    y += 5;
    doc.text("Discount:", labelX, y);
    doc.text(`- INR ${data.discountAmount.toFixed(2)}`, rightX, y, { align: "right" });
  }

  if (data.taxAmount > 0) {
    y += 5;
    doc.text(`GST (${data.taxRate}%):`, labelX, y);
    doc.text(`+ INR ${data.taxAmount.toFixed(2)}`, rightX, y, { align: "right" });
  }

  y += 6;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(labelX, y, rightX, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grand Total:", labelX, y);
  doc.text(`INR ${data.grandTotal.toFixed(2)}`, rightX, y, { align: "right" });

  // Footer
  y += 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Thank you for shopping with us! This is an official computer-generated receipt.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

