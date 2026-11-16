import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsView, {
  CustomerOption,
  InvoiceReportItem,
  InvoiceReportLineItem,
  PaymentReportItem,
  ProductOption,
  StockReportItem,
} from "./reports-view";

export const metadata = {
  title: "Sales Reports & Analytics | Qelanto Business OS",
};

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: string | null }> {
  const allRows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) {
      return { data: [], error: error.message };
    }

    const rows = data || [];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) {
      return { data: allRows, error: null };
    }
  }
}

export default async function ReportsPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const [invoiceResult, itemResult, paymentResult, customerResult, productResult] =
    await Promise.all([
      fetchAllPages((from, to) =>
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, customer_id, customer_name_snapshot, customer_phone_snapshot, subtotal, discount_amount, tax_amount, grand_total, payment_status, created_at"
          )
          .eq("business_id", businessId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("invoice_items")
          .select(
            "id, invoice_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, total_price, invoice:invoices!inner(business_id)"
          )
          .eq("invoice.business_id", businessId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("payments")
          .select("id, invoice_id, payment_method, amount, paid_at, created_at")
          .eq("business_id", businessId)
          .order("paid_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("business_id", businessId)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase
          .from("products")
          .select(
            "id, name, sku, stock_quantity, selling_price, purchase_price, low_stock_threshold, is_active"
          )
          .eq("business_id", businessId)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      ),
    ]);

  const queryError = [
    invoiceResult.error,
    itemResult.error,
    paymentResult.error,
    customerResult.error,
    productResult.error,
  ].find((error): error is string => error !== null);

  if (queryError) {
    return (
      <div className="-m-4 min-h-full bg-slate-50 p-4 sm:-m-6 sm:p-6">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-800 shadow-sm"
        >
          <p className="font-semibold">Unable to load sales reports.</p>
          <p className="mt-1">{queryError}</p>
        </div>
      </div>
    );
  }

  const payments: PaymentReportItem[] = paymentResult.data.map((payment) => ({
    invoice_id: payment.invoice_id,
    payment_method: payment.payment_method,
    amount: Number(payment.amount || 0),
  }));
  const paymentMethodsByInvoice = new Map<string, Set<string>>();
  for (const payment of paymentResult.data) {
    const methods = paymentMethodsByInvoice.get(payment.invoice_id) || new Set();
    methods.add(payment.payment_method);
    paymentMethodsByInvoice.set(payment.invoice_id, methods);
  }

  const invoices: InvoiceReportItem[] = invoiceResult.data.map((invoice) => ({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    customer_id: invoice.customer_id,
    customer_name: invoice.customer_name_snapshot,
    customer_phone: invoice.customer_phone_snapshot,
    subtotal: Number(invoice.subtotal || 0),
    discount_amount: Number(invoice.discount_amount || 0),
    tax_amount: Number(invoice.tax_amount || 0),
    grand_total: Number(invoice.grand_total || 0),
    payment_method:
      Array.from(paymentMethodsByInvoice.get(invoice.id) || []).join(", ") ||
      "unknown",
    payment_status: invoice.payment_status,
    created_at: invoice.created_at,
  }));

  const invoiceItems: InvoiceReportLineItem[] = itemResult.data.map((item) => ({
    id: item.id,
    invoice_id: item.invoice_id,
    product_id: item.product_id,
    product_name: item.product_name_snapshot,
    sku: item.sku_snapshot,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total_price: Number(item.total_price || 0),
  }));

  const customerMap = new Map<string, CustomerOption>();
  for (const customer of customerResult.data) {
    customerMap.set(customer.id, {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    });
  }
  for (const invoice of invoices) {
    if (!invoice.customer_id) {
      const id = `snapshot:${invoice.customer_phone || ""}:${invoice.customer_name}`;
      if (!customerMap.has(id)) {
        customerMap.set(id, {
          id,
          name: invoice.customer_name,
          phone: invoice.customer_phone,
        });
      }
    }
  }

  const productMap = new Map<string, ProductOption>();
  for (const product of productResult.data) {
    productMap.set(product.id, {
      id: product.id,
      name: product.name,
      sku: product.sku,
    });
  }
  for (const item of invoiceItems) {
    if (!item.product_id) {
      const id = `sku:${item.sku}`;
      if (!productMap.has(id)) {
        productMap.set(id, {
          id,
          name: item.product_name,
          sku: item.sku,
        });
      }
    }
  }

  const stockReport: StockReportItem[] = productResult.data
    .filter((product) => product.is_active)
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock_quantity: Number(product.stock_quantity || 0),
      selling_price: Number(product.selling_price || 0),
      purchase_price: Number(product.purchase_price || 0),
      low_stock_threshold: Number(product.low_stock_threshold || 0),
    }));

  return (
    <div className="-m-4 min-h-full space-y-6 bg-slate-50 p-4 sm:-m-6 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reports & Financial Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Filter sales, review financial performance, and export matching records
        </p>
      </div>

      <ReportsView
        invoices={invoices}
        invoiceItems={invoiceItems}
        payments={payments}
        customers={Array.from(customerMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        )}
        products={Array.from(productMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        )}
        stockReport={stockReport}
        currency={context.business.currency}
        timezone={context.business.timezone}
      />
    </div>
  );
}
