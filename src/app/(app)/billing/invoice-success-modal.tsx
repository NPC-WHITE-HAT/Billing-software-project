"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Printer, MessageSquare, ArrowRight, Loader2, FileText } from "lucide-react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: number;
  customerPhone?: string | null;
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
  hasWhatsappConsent,
}: Props) {
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSendWhatsapp() {
    setSendingWhatsapp(true);
    setWhatsappStatus(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (data.success) {
        setWhatsappStatus("WhatsApp invoice dispatched successfully!");
      } else {
        setWhatsappStatus(data.error || "Could not send WhatsApp message.");
      }
    } catch {
      setWhatsappStatus("Network error sending WhatsApp invoice.");
    } finally {
      setSendingWhatsapp(false);
    }
  }

  function handlePrint() {
    const printWindow = window.open(`/invoices/${invoiceId}/print`, "_blank");
    if (printWindow) {
      printWindow.focus();
    }
  }

  function handleDirectWhatsApp() {
    if (!customerPhone) return;
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const billUrl = `${window.location.origin}/invoices/${invoiceId}/print`;
    const message = encodeURIComponent(
      `Hello ${customerName || "Valued Customer"}! 🙏\n\nThank you for shopping with us!\nYour Tax Invoice *${invoiceNumber}* for *₹${grandTotal.toFixed(2)}* is ready.\n\n📄 View / Download your Bill PDF here:\n${billUrl}\n\nHave a wonderful day!`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
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
          {customerName && (
            <div className="mt-2 text-xs text-slate-500">
              Customer: <span className="font-medium text-slate-700">{customerName}</span>{" "}
              {customerPhone && <span className="font-mono">({customerPhone})</span>}
            </div>
          )}
        </div>

        {whatsappStatus && (
          <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {whatsappStatus}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Tax Invoice (PDF)</span>
          </button>

          {customerPhone ? (
            <button
              onClick={handleDirectWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send Bill to WhatsApp (Direct & PDF Link)</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const phone = prompt("Enter customer WhatsApp mobile number (10 digits):");
                if (phone && phone.trim().length >= 10) {
                  const cleanPhone = phone.replace(/\D/g, "");
                  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                  const billUrl = `${window.location.origin}/invoices/${invoiceId}/print`;
                  const message = encodeURIComponent(
                    `Hello Valued Customer! 🙏\n\nThank you for shopping with us!\nYour Tax Invoice *${invoiceNumber}* for *₹${grandTotal.toFixed(2)}* is ready.\n\n📄 View / Download your Bill PDF here:\n${billUrl}\n\nHave a wonderful day!`
                  );
                  window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send Bill to WhatsApp (Enter Mobile Number)</span>
            </button>
          )}

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
