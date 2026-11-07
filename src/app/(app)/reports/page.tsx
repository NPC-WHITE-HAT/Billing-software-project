import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsView, {
  DailySummaryItem,
  PaymentSummaryItem,
  TopProductItem,
  StockReportItem,
  InvoiceReportItem,
} from "./reports-view";

export const metadata = {
  title: "Sales Reports & Analytics | Qelanto Business OS",
};

export default async function ReportsPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // 1. Fetch all completed invoices for this business
  const { data: allInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name_snapshot, customer_phone_snapshot, grand_total, payment_status, created_at, payments:payments(payment_method)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const invoiceList: InvoiceReportItem[] = (allInvoices || []).map((inv) => {
    const payMethod = inv.payments?.[0]?.payment_method || "cash";
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name_snapshot,
      customer_phone: inv.customer_phone_snapshot,
      grand_total: Number(inv.grand_total || 0),
      payment_method: payMethod,
      payment_status: inv.payment_status,
      created_at: inv.created_at,
    };
  });

  // Calculate Today's, Weekly, Monthly metrics
  let todaySales = 0;
  let todayCount = 0;
  let weekSales = 0;
  let weekCount = 0;
  let monthSales = 0;
  let monthCount = 0;

  invoiceList.forEach((inv) => {
    const amount = inv.grand_total;
    if (inv.created_at >= todayStart) {
      todaySales += amount;
      todayCount += 1;
    }
    if (inv.created_at >= sevenDaysAgo) {
      weekSales += amount;
      weekCount += 1;
    }
    if (inv.created_at >= monthStart) {
      monthSales += amount;
      monthCount += 1;
    }
  });

  // Daily Breakdown (last 7 days)
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { count: 0, revenue: 0 });
  }

  invoiceList.forEach((inv) => {
    const key = inv.created_at.slice(0, 10);
    if (dailyMap.has(key)) {
      const entry = dailyMap.get(key)!;
      entry.count += 1;
      entry.revenue += inv.grand_total;
    }
  });

  const dailyBreakdown: DailySummaryItem[] = Array.from(dailyMap.entries()).map(
    ([date, val]) => ({
      date,
      count: val.count,
      revenue: val.revenue,
    })
  );

  // Payment Method Summary
  const payMap = new Map<string, { count: number; amount: number }>();
  ["cash", "upi", "card"].forEach((m) => payMap.set(m, { count: 0, amount: 0 }));

  invoiceList.forEach((inv) => {
    const m = inv.payment_method.toLowerCase();
    const entry = payMap.get(m) || { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += inv.grand_total;
    payMap.set(m, entry);
  });

  const totalAllRevenue = invoiceList.reduce((sum, inv) => sum + inv.grand_total, 0);

  const paymentSummary: PaymentSummaryItem[] = Array.from(payMap.entries()).map(
    ([method, val]) => ({
      method,
      count: val.count,
      amount: val.amount,
      percentage: totalAllRevenue > 0 ? (val.amount / totalAllRevenue) * 100 : 0,
    })
  );

  // 2. Fetch Best-Selling Products from invoice_items
  const { data: rawItems } = await supabase
    .from("invoice_items")
    .select("product_id, product_name_snapshot, sku_snapshot, quantity, total_price, invoice:invoices!inner(business_id)")
    .eq("invoice.business_id", businessId);

  const prodAggMap = new Map<string, { name: string; sku: string; qty: number; rev: number }>();

  (rawItems || []).forEach((item) => {
    const pid = item.product_id || item.sku_snapshot;
    const cur = prodAggMap.get(pid) || {
      name: item.product_name_snapshot,
      sku: item.sku_snapshot,
      qty: 0,
      rev: 0,
    };
    cur.qty += Number(item.quantity || 0);
    cur.rev += Number(item.total_price || 0);
    prodAggMap.set(pid, cur);
  });

  const topProducts: TopProductItem[] = Array.from(prodAggMap.entries())
    .map(([id, val]) => ({
      id,
      name: val.name,
      sku: val.sku,
      totalQuantity: val.qty,
      totalRevenue: val.rev,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10);

  // 3. Stock Report
  const { data: stockItems } = await supabase
    .from("products")
    .select("id, name, sku, stock_quantity, selling_price, purchase_price, low_stock_threshold")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const stockReport: StockReportItem[] = (stockItems || []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock_quantity: Number(p.stock_quantity),
    selling_price: Number(p.selling_price),
    purchase_price: Number(p.purchase_price || 0),
    low_stock_threshold: Number(p.low_stock_threshold),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Reports & Financial Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sales summaries, payment distributions, top products, and inventory valuation
        </p>
      </div>

      <ReportsView
        todaySales={todaySales}
        todayCount={todayCount}
        weekSales={weekSales}
        weekCount={weekCount}
        monthSales={monthSales}
        monthCount={monthCount}
        dailyBreakdown={dailyBreakdown}
        paymentSummary={paymentSummary}
        topProducts={topProducts}
        stockReport={stockReport}
        invoices={invoiceList}
        currency={context.business.currency}
      />
    </div>
  );
}

