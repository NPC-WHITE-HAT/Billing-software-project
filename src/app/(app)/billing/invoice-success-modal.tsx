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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white">Invoice Generated</h2>
        <p className="font-mono text-sm font-semibold text-blue-400 mt-1">
          {invoiceNumber}
        </p>

        <div className="my-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-xs text-slate-400">Total Billed & Paid</div>
          <div className="text-3xl font-extrabold font-mono text-white mt-1">
            {formatCurrency(grandTotal)}
          </div>
          {customerName && (
            <div className="text-xs text-slate-400 mt-2">
              Customer: <span className="text-slate-200 font-medium">{customerName}</span>{" "}
              {customerPhone && <span className="font-mono">({customerPhone})</span>}
            </div>
          )}
        </div>

        {whatsappStatus && (
          <div className="mb-4 p-3 rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs text-blue-300">
            {whatsappStatus}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Tax Invoice (PDF)</span>
          </button>

          {customerPhone && hasWhatsappConsent && (
            <button
              onClick={handleSendWhatsapp}
              disabled={sendingWhatsapp}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
            >
              {sendingWhatsapp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending via Meta Cloud API...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  <span>Send PDF Receipt to WhatsApp</span>
                </>
              )}
            </button>
          )}

          <Link
            href={`/invoices/${invoiceId}/print`}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Open Dedicated Bill View</span>
          </Link>

          <button
            onClick={onClose}
            className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
          >
            <span>Next Customer / New Bill</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

