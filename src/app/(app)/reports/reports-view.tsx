"use client";

import { useState } from "react";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/utils";
import {
  Download,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  TrendingUp,
  Package,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

export interface DailySummaryItem {
  date: string;
  count: number;
  revenue: number;
}

export interface PaymentSummaryItem {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface TopProductItem {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface StockReportItem {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  selling_price: number;
  purchase_price: number;
  low_stock_threshold: number;
}

export interface InvoiceReportItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string | null;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface Props {
  todaySales: number;
  todayCount: number;
  weekSales: number;
  weekCount: number;
  monthSales: number;
  monthCount: number;
  dailyBreakdown: DailySummaryItem[];
  paymentSummary: PaymentSummaryItem[];
  topProducts: TopProductItem[];
  stockReport: StockReportItem[];
  invoices: InvoiceReportItem[];
  currency: string;
}

export default function ReportsView({
  todaySales,
  todayCount,
  weekSales,
  weekCount,
  monthSales,
  monthCount,
  dailyBreakdown,
  paymentSummary,
  topProducts,
  stockReport,
  invoices,
}: Props) {
  const [activeTab, setActiveTab] = useState<"sales" | "payments" | "products" | "stock">("sales");

  // CSV Exporters
  function exportInvoicesCSV() {
    const headers = ["Invoice Number", "Date", "Customer Name", "Phone", "Amount (INR)", "Payment Method", "Status"];
    const rows = invoices.map((inv) => [
      inv.invoice_number,
      formatDate(inv.created_at),
      `"${inv.customer_name}"`,
      inv.customer_phone || "",
      inv.grand_total.toFixed(2),
      inv.payment_method,
      inv.payment_status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadBlob(csvContent, `Invoices_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportStockCSV() {
    const headers = ["Product Name", "SKU", "Current Stock", "Selling Price", "Purchase Cost", "Inventory Value"];
    const rows = stockReport.map((p) => [
      `"${p.name}"`,
      p.sku,
      p.stock_quantity,
      p.selling_price.toFixed(2),
      p.purchase_price.toFixed(2),
      (p.stock_quantity * p.selling_price).toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadBlob(csvContent, `Stock_Valuation_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function downloadBlob(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Global Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 p-1 border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "sales"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sales Overview
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "payments"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Payment Methods
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "products"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Best-Sellers
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "stock"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Stock Valuation
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportInvoicesCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Invoices CSV</span>
          </button>
          <button
            onClick={exportStockCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Stock CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Daily Sales (Today)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-white">
            {formatCurrency(todaySales)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {todayCount} invoices billed today
          </div>
        </div>

        {/* Weekly */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Weekly Sales (Last 7 Days)
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-white">
            {formatCurrency(weekSales)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {weekCount} total invoices this week
          </div>
        </div>

        {/* Monthly */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Monthly Sales (This Month)
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-white">
            {formatCurrency(monthSales)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {monthCount} invoices in current calendar month
          </div>
        </div>
      </div>

      {/* TAB CONTENT 1: Sales Daily Breakdown */}
      {activeTab === "sales" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              7-Day Daily Sales Breakdown
            </h2>
            <p className="text-xs text-slate-400">Daily transaction volume and revenue</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-center">Invoices Billed</th>
                  <th className="pb-3 text-right">Daily Revenue</th>
                  <th className="pb-3 text-right">Avg. Ticket Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dailyBreakdown.map((day) => {
                  const avg = day.count > 0 ? day.revenue / day.count : 0;
                  return (
                    <tr key={day.date} className="hover:bg-slate-800/30 transition text-xs">
                      <td className="py-3 font-semibold text-slate-200">
                        {formatShortDate(day.date)}
                      </td>
                      <td className="py-3 text-center font-mono text-slate-300">
                        {day.count}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-white">
                        {formatCurrency(day.revenue)}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        {formatCurrency(avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Payment Methods Summary */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Payment Method Distribution</h2>
            <p className="text-xs text-slate-400">Breakdown of collections across Cash, UPI and Cards</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {paymentSummary.map((p) => {
              const Icon =
                p.method === "cash"
                  ? Banknote
                  : p.method === "upi"
                  ? QrCode
                  : CreditCard;

              return (
                <div
                  key={p.method}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize font-bold text-sm text-slate-200 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-blue-400" />
                      {p.method.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {p.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-3 text-xl font-bold font-mono text-white">
                    {formatCurrency(p.amount)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {p.count} transactions recorded
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: Best-Selling Products */}
      {activeTab === "products" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Best-Selling Products</h2>
            <p className="text-xs text-slate-400">Ranked by unit sales volume</p>
          </div>

          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No sales recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 w-10">Rank</th>
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3">SKU</th>
                    <th className="pb-3 text-center">Units Sold</th>
                    <th className="pb-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {topProducts.map((prod, idx) => (
                    <tr key={prod.id} className="hover:bg-slate-800/30 transition text-xs">
                      <td className="py-3 font-mono font-bold text-slate-500">
                        #{idx + 1}
                      </td>
                      <td className="py-3 font-semibold text-slate-100">
                        {prod.name}
                      </td>
                      <td className="py-3 font-mono text-blue-400">
                        {prod.sku}
                      </td>
                      <td className="py-3 text-center font-mono font-bold text-white">
                        {prod.totalQuantity}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(prod.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: Stock Valuation Report */}
      {activeTab === "stock" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Stock Valuation & Inventory Assets</h2>
              <p className="text-xs text-slate-400">Retail asset value across all active stock</p>
            </div>
            <button
              onClick={exportStockCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Stock Report</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3">SKU</th>
                  <th className="pb-3 text-center">Stock Count</th>
                  <th className="pb-3 text-right">Selling Price</th>
                  <th className="pb-3 text-right">Purchase Cost</th>
                  <th className="pb-3 text-right">Retail Asset Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockReport.map((p) => {
                  const val = p.stock_quantity * p.selling_price;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition text-xs">
                      <td className="py-3 font-semibold text-slate-100">{p.name}</td>
                      <td className="py-3 font-mono text-blue-400">{p.sku}</td>
                      <td className="py-3 text-center font-mono font-bold text-white">
                        {p.stock_quantity}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-300">
                        {formatCurrency(p.selling_price)}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        {p.purchase_price ? formatCurrency(p.purchase_price) : "-"}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(val)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

