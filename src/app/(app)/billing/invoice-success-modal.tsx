"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Printer, MessageSquare, ArrowRight, FileText, ArrowLeft, X } from "lucide-react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: number;
  customerPhone: string;
  customerName?: string | null;
  hasWhatsappConsent?: boolean;
}

export default function InvoiceSuccessModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  grandTotal,
  customerPhone,
  customerName,
}: Props) {
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleDirectWhatsApp() {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const billUrl = `${window.location.origin}/invoices/${invoiceId}/print`;
    const message = encodeURIComponent(
      `Hello ${customerName || "Valued Customer"}! 🙏\n\nThank you for shopping with us!\nYour Tax Invoice *${invoiceNumber}* for *₹${grandTotal.toFixed(2)}* is ready.\n\n📄 View / Download your Bill PDF here:\n${billUrl}\n\nHave a wonderful day!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
    setWhatsappStatus("WhatsApp window opened with bill invoice!");
  }

  function handlePrint() {
    const printWindow = window.open(`/invoices/${invoiceId}/print`, "_blank");
    if (printWindow) {
      printWindow.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
        {/* Top Header Back / Close Action */}
        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            title="Back to POS Terminal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to POS</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-slate-900">Invoice Generated</h2>
        <p className="mt-1 font-mono text-sm font-semibold text-blue-700">
          {invoiceNumber}
        </p>

        <div className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Total Billed & Paid</div>
          <div className="mt-1 font-mono text-3xl font-extrabold text-slate-950">
            {formatCurrency(grandTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Customer: <span className="font-medium text-slate-700">{customerName || "Customer"}</span>{" "}
            <span className="font-mono font-semibold text-emerald-700">({customerPhone})</span>
          </div>
        </div>

        {whatsappStatus && (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            {whatsappStatus}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={handleDirectWhatsApp}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send Bill to WhatsApp (Automatic to {customerPhone})</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Tax Invoice (PDF)</span>
          </button>

          <Link
            href={`/invoices/${invoiceId}/print`}
            target="_blank"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Open Dedicated Bill View</span>
          </Link>

          <button
            onClick={onClose}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <span>Next Customer / New Bill</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
