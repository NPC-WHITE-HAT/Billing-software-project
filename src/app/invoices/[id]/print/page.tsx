import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import PrintButton from "./print-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintInvoicePage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch invoice with line items & payment
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*), payments:payments(*)")
    .eq("id", id)
    .single();

  if (invError || !invoice) {
    notFound();
  }

  // 2. Fetch business details
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", invoice.business_id)
    .single();

  // 3. Fetch branch
  const { data: branch } = await supabase
    .from("branches")
    .select("*")
    .eq("id", invoice.branch_id || "")
    .maybeSingle();

  const payments = invoice.payments || [];
  const primaryPayment = payments[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:text-black py-8 px-4 flex flex-col items-center">
      {/* Top action bar (hidden on print) */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between print:hidden">
        <a
          href="/billing"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          &larr; Back to Billing POS
        </a>
        <PrintButton />
      </div>

      {/* Printable Invoice Container */}
      <div
        id="printable-invoice"
        className="w-full max-w-2xl bg-white border border-slate-300 print:border-none p-8 rounded-2xl shadow-lg print:shadow-none print:p-0"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-300 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {business?.name || "Retail Store"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {business?.category || "Retail Store"}
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-xs">
              {branch?.address || business?.address || ""}
              {business?.city && `, ${business.city}`}
              {business?.state && `, ${business.state}`}
              {business?.pincode && ` - ${business.pincode}`}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Phone: {branch?.phone || business?.phone || "-"}
            </p>
            {business?.gstin && (
              <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                GSTIN: {business.gstin}
              </p>
            )}
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-md bg-slate-900 text-white print:bg-black text-xs font-bold uppercase tracking-wider">
              Tax Invoice
            </span>
            <div className="mt-2 font-mono font-bold text-sm text-slate-900">
              {invoice.invoice_number}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Date: {formatDate(invoice.created_at)}
            </div>
            <div className="text-xs text-slate-500">
              Status: <span className="font-semibold uppercase text-emerald-700">{invoice.payment_status}</span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="py-4 border-b border-slate-200 grid grid-cols-2 text-xs">
          <div>
            <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
              Billed To:
            </span>
            <div className="font-bold text-sm text-slate-900">
              {invoice.customer_name_snapshot}
            </div>
            {invoice.customer_phone_snapshot && (
              <div className="font-mono text-slate-600 mt-0.5">
                Phone: {invoice.customer_phone_snapshot}
              </div>
            )}
          </div>
          <div className="text-right">
            <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
              Payment Details:
            </span>
            <div className="font-bold text-slate-900 uppercase">
              Method: {primaryPayment?.payment_method || "Cash"}
            </div>
            {primaryPayment?.reference_number && (
              <div className="font-mono text-slate-600 text-[11px] mt-0.5">
                Ref: {primaryPayment.reference_number}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="py-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[11px] uppercase tracking-wider font-bold text-slate-800">
                <th className="py-2 w-8">#</th>
                <th className="py-2">Item Description</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items?.map((item: { id: string; product_name_snapshot: string; sku_snapshot: string; quantity: number; unit_price: number; total_price: number }, idx: number) => (
                <tr key={item.id} className="py-2">
                  <td className="py-2.5 text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 font-semibold text-slate-900">
                    {item.product_name_snapshot}
                  </td>
                  <td className="py-2.5 font-mono text-slate-500">
                    {item.sku_snapshot}
                  </td>
                  <td className="py-2.5 text-right font-mono font-semibold">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 text-right font-mono">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="border-t-2 border-slate-900 pt-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>

            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount Applied:</span>
                <span className="font-mono font-semibold">
                  - {formatCurrency(invoice.discount_amount)}
                </span>
              </div>
            )}

            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>GST / Tax ({invoice.tax_rate}%):</span>
                <span className="font-mono font-semibold">
                  + {formatCurrency(invoice.tax_amount)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 flex justify-between items-baseline text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-lg font-black font-mono">
                {formatCurrency(invoice.grand_total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">
            Thank you for shopping with us!
          </p>
          <p>
            This is a computer-generated invoice. For exchange queries, please present this invoice within 7 days.
          </p>
        </div>
      </div>
    </div>
  );
}

