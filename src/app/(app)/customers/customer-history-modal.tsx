"use client";

import { useEffect, useState } from "react";
import { getCustomerInvoices } from "./actions";
import { CustomerItem } from "./customer-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { X, Loader2, Receipt, Clock, PackageCheck } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerItem | null;
}

interface InvoiceItemSnapshot {
  id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CustomerInvoice {
  id: string;
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  payment_status: string;
  created_at: string;
  items: InvoiceItemSnapshot[];
}

function CustomerHistoryInner({
  customer,
  onClose,
}: {
  customer: CustomerItem;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchHistory() {
      try {
        const res = await getCustomerInvoices(customer.id);
        if (isMounted && res.success && res.invoices) {
          setInvoices(res.invoices as unknown as CustomerInvoice[]);
        }
      } catch (err) {
        console.error("Failed to load customer invoices:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [customer.id]);

  const totalSpent = invoices.reduce(
    (sum, inv) => sum + Number(inv.grand_total || 0),
    0
  );

  return (
    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-blue-400">
            Customer Purchase History
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">
            {customer.name} &bull;{" "}
            <span className="font-mono text-slate-300">{customer.phone}</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 bg-slate-950/40 p-4 border-b border-slate-800 text-center">
        <div>
          <div className="text-xs text-slate-400">Total Orders</div>
          <div className="text-lg font-bold font-mono text-white">
            {invoices.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Lifetime Spent</div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {formatCurrency(totalSpent)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Loading billing records...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">
              No previous invoices found for this customer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono font-bold text-sm text-blue-400">
                      {inv.invoice_number}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(inv.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-base text-white">
                      {formatCurrency(inv.grand_total)}
                    </div>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {inv.payment_status}
                    </span>
                  </div>
                </div>

                {/* Line item snapshots */}
                {inv.items && inv.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5" /> Items Purchased:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {inv.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60"
                        >
                          <span className="truncate max-w-[150px] text-slate-300">
                            {item.product_name_snapshot}
                          </span>
                          <span className="font-mono text-slate-400 shrink-0">
                            {item.quantity} × {formatCurrency(item.unit_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-right">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function CustomerHistoryModal({
  isOpen,
  onClose,
  customer,
}: Props) {
  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <CustomerHistoryInner
        key={customer.id}
        customer={customer}
        onClose={onClose}
      />
    </div>
  );
}
