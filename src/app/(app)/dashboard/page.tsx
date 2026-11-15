import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  Clock,
  CalendarDays,
  PlusCircle,
  ReceiptText,
} from "lucide-react";

export const metadata = {
  title: "Dashboard | Qelanto Business OS",
};

export default async function DashboardPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  // Calculate Start of Today and Start of Current Month in IST
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: todayInvoices },
    { data: monthInvoices },
    { count: totalCustomersCount },
    { count: totalProductsCount },
    { count: totalInvoicesCount },
    { data: lowStockProducts },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("grand_total")
      .eq("business_id", businessId)
      .eq("status", "completed")
      .gte("created_at", todayStart),
    supabase
      .from("invoices")
      .select("grand_total")
      .eq("business_id", businessId)
      .eq("status", "completed")
      .gte("created_at", monthStart),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("products")
      .select("id, name, sku, stock_quantity, low_stock_threshold")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true })
      .limit(10),
    supabase
      .from("invoices")
      .select("id, invoice_number, customer_name_snapshot, customer_phone_snapshot, grand_total, payment_status, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const todaySales = (todayInvoices || []).reduce(
    (sum, inv) => sum + Number(inv.grand_total || 0),
    0
  );
  const todayInvoicesCount = (todayInvoices || []).length;

  const monthSales = (monthInvoices || []).reduce(
    (sum, inv) => sum + Number(inv.grand_total || 0),
    0
  );
  const monthInvoicesCount = (monthInvoices || []).length;

  const actualLowStock = (lowStockProducts || []).filter(
    (p) => p.stock_quantity <= p.low_stock_threshold
  );

  return (
    <div className="-m-4 min-h-full space-y-6 bg-slate-50 p-4 text-slate-900 sm:-m-6 sm:space-y-8 sm:p-6 lg:p-8">
      {/* Welcome Banner */}
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Business overview
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back, {context.user.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {context.business.name} &bull; Main Branch Retail Terminal
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ReceiptText className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </section>

      {/* Metric Cards Grid */}
      <section aria-label="Business metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Today's Sales */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Today&apos;s Sales
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatCurrency(todaySales)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{todayInvoicesCount} invoices billed today</span>
          </div>
        </article>

        {/* Monthly Sales */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              This Month
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatCurrency(monthSales)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {monthInvoicesCount} invoices this month
          </div>
        </article>

        {/* Total Customers */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Customers
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {totalCustomersCount ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Registered customer profiles
          </div>
        </article>

        {/* Total Products & Low Stock */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Inventory
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {totalProductsCount ?? 0}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{actualLowStock.length} items low in stock</span>
          </div>
        </article>
      </section>

      {/* Two Column Section: Recent Invoices & Low Stock Alert */}
      <section aria-label="Recent activity and stock alerts" className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Recent Invoices Table (2 cols) */}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Invoices</h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest customer billing transactions ({totalInvoicesCount ?? 0} total)
              </p>
            </div>
            <Link
              href="/reports"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 transition hover:text-blue-800"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!recentInvoices || recentInvoices.length === 0) ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
              <Receipt className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No invoices generated yet</p>
              <p className="mt-1 text-xs text-slate-500">Start by creating your first bill in POS Terminal</p>
              <Link
                href="/billing"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create Bill
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-3 font-semibold">Invoice #</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Date & Time</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                      <td className="py-3 font-mono font-semibold text-blue-700">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 text-slate-700">
                        <div className="font-medium text-slate-800">{inv.customer_name_snapshot}</div>
                        {inv.customer_phone_snapshot && (
                          <div className="font-mono text-[11px] text-slate-400">
                            {inv.customer_phone_snapshot}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-xs text-slate-500">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {inv.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts (1 col) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Stock Alerts</h2>
              <p className="mt-1 text-xs text-slate-500">Items nearing replenishment threshold</p>
            </div>
            <Link
              href="/inventory"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 transition hover:text-blue-800"
            >
              Stock <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {actualLowStock.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
              <Package className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <p className="text-sm font-medium text-slate-700">Stock Levels Healthy</p>
              <p className="mt-1 text-xs text-slate-500">No products are currently below their low-stock limit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actualLowStock.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-3"
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {prod.name}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      SKU: {prod.sku}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-amber-700">
                      {prod.stock_quantity} Left
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Min: {prod.low_stock_threshold}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
