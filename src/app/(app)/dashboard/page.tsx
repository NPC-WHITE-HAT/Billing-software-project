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

  // 1. Fetch Today's Invoices & Sales
  const { data: todayInvoices } = await supabase
    .from("invoices")
    .select("grand_total")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .gte("created_at", todayStart);

  const todaySales = (todayInvoices || []).reduce(
    (sum, inv) => sum + Number(inv.grand_total || 0),
    0
  );
  const todayInvoicesCount = (todayInvoices || []).length;

  // 2. Fetch Monthly Sales
  const { data: monthInvoices } = await supabase
    .from("invoices")
    .select("grand_total")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .gte("created_at", monthStart);

  const monthSales = (monthInvoices || []).reduce(
    (sum, inv) => sum + Number(inv.grand_total || 0),
    0
  );
  const monthInvoicesCount = (monthInvoices || []).length;

  // 3. Total Customers Count
  const { count: totalCustomersCount } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId);

  // 4. Total Active Products Count
  const { count: totalProductsCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true);

  // 5. Total Invoices Count
  const { count: totalInvoicesCount } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId);

  // 6. Low Stock Products
  const { data: lowStockProducts } = await supabase
    .from("products")
    .select("id, name, sku, stock_quantity, low_stock_threshold")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("stock_quantity", { ascending: true })
    .limit(10);

  const actualLowStock = (lowStockProducts || []).filter(
    (p) => p.stock_quantity <= p.low_stock_threshold
  );

  // 7. Recent Invoices
  const { data: recentInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name_snapshot, customer_phone_snapshot, grand_total, payment_status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-500/20 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, {context.user.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {context.business.name} &bull; Main Branch Retail Terminal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/billing"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
          >
            <ReceiptText className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Today&apos;s Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white font-mono">
            {formatCurrency(todaySales)}
          </div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{todayInvoicesCount} invoices billed today</span>
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              This Month
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white font-mono">
            {formatCurrency(monthSales)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {monthInvoicesCount} invoices this month
          </div>
        </div>

        {/* Total Customers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Customers
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white font-mono">
            {totalCustomersCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Registered customer profiles
          </div>
        </div>

        {/* Total Products & Low Stock */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Inventory
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white font-mono">
            {totalProductsCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{actualLowStock.length} items low in stock</span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Invoices & Low Stock Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Recent Invoices</h2>
              <p className="text-xs text-slate-400">
                Latest customer billing transactions ({totalInvoicesCount ?? 0} total)
              </p>
            </div>
            <Link
              href="/reports"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!recentInvoices || recentInvoices.length === 0) ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No invoices generated yet</p>
              <p className="text-xs mt-1">Start by creating your first bill in POS Terminal</p>
              <Link
                href="/billing"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create Bill
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="pb-3 font-semibold">Invoice #</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Date & Time</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 font-mono font-semibold text-blue-400">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 text-slate-200">
                        <div>{inv.customer_name_snapshot}</div>
                        {inv.customer_phone_snapshot && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            {inv.customer_phone_snapshot}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-slate-400 text-xs">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-white">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Stock Alerts</h2>
              <p className="text-xs text-slate-400">Items nearing replenishment threshold</p>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            >
              Stock <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {actualLowStock.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-400" />
              <p className="text-sm font-medium text-slate-300">Stock Levels Healthy</p>
              <p className="text-xs mt-1">No products are currently below their low-stock limit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actualLowStock.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-500/5"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-sm font-semibold text-slate-200 truncate">
                      {prod.name}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      SKU: {prod.sku}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-amber-400">
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
      </div>
    </div>
  );
}

