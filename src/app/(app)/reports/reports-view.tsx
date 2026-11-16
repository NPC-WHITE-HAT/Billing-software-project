"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CreditCard,
  Download,
  FileSpreadsheet,
  Package,
  QrCode,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface InvoiceReportItem {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export interface InvoiceReportLineItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PaymentReportItem {
  invoice_id: string;
  payment_method: string;
  amount: number;
}

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
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

interface Props {
  invoices: InvoiceReportItem[];
  invoiceItems: InvoiceReportLineItem[];
  payments: PaymentReportItem[];
  customers: CustomerOption[];
  products: ProductOption[];
  stockReport: StockReportItem[];
  currency: string;
  timezone: string;
}

type DatePreset = "all" | "today" | "yesterday" | "last7" | "last30" | "custom";
type ActiveTab = "sales" | "payments" | "products" | "stock";
type ExportType = "invoices" | "products" | "customers" | "complete";

interface Filters {
  datePreset: DatePreset;
  fromDate: string;
  toDate: string;
  month: string;
  year: string;
  customerId: string;
  customerSearch: string;
  productId: string;
  productSearch: string;
  minimum: string;
  maximum: string;
}

interface DateBounds {
  start: string;
  end: string;
}

interface SalesGroup {
  name: string;
  sku?: string;
  phone?: string | null;
  quantity: number;
  revenue: number;
  invoiceIds: Set<string>;
}

const EMPTY_FILTERS: Filters = {
  datePreset: "all",
  fromDate: "",
  toDate: "",
  month: "",
  year: "",
  customerId: "",
  customerSearch: "",
  productId: "",
  productSearch: "",
  minimum: "",
  maximum: "",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function dateKey(value: string | Date, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatInvoiceDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(value));
}

function formatDateKey(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getDateBounds(filters: Filters, timezone: string): DateBounds {
  const today = dateKey(new Date(), timezone);
  let start = "";
  let end = "";

  if (filters.datePreset === "today") {
    start = today;
    end = today;
  } else if (filters.datePreset === "yesterday") {
    start = shiftDate(today, -1);
    end = start;
  } else if (filters.datePreset === "last7") {
    start = shiftDate(today, -6);
    end = today;
  } else if (filters.datePreset === "last30") {
    start = shiftDate(today, -29);
    end = today;
  } else if (filters.datePreset === "custom") {
    start = filters.fromDate;
    end = filters.toDate;
  }

  if (filters.year) {
    const yearStart = `${filters.year}-01-01`;
    const yearEnd = `${filters.year}-12-31`;
    start = start ? (start > yearStart ? start : yearStart) : yearStart;
    end = end ? (end < yearEnd ? end : yearEnd) : yearEnd;
  }

  if (filters.month) {
    if (filters.year) {
      const monthStart = `${filters.year}-${filters.month.padStart(2, "0")}-01`;
      const monthEnd = `${filters.year}-${filters.month.padStart(2, "0")}-${String(
        new Date(
          Date.UTC(Number(filters.year), Number(filters.month), 0)
        ).getUTCDate()
      ).padStart(2, "0")}`;
      start = start ? (start > monthStart ? start : monthStart) : monthStart;
      end = end ? (end < monthEnd ? end : monthEnd) : monthEnd;
    }
  }

  return { start, end };
}

function productKeyMatches(item: InvoiceReportLineItem, selectedId: string) {
  if (selectedId.startsWith("sku:")) {
    return !item.product_id && `sku:${item.sku}` === selectedId;
  }
  return item.product_id === selectedId;
}

function customerKeyMatches(invoice: InvoiceReportItem, selectedId: string) {
  if (selectedId.startsWith("snapshot:")) {
    return (
      !invoice.customer_id &&
      `snapshot:${invoice.customer_phone || ""}:${invoice.customer_name}` ===
        selectedId
    );
  }
  return invoice.customer_id === selectedId;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: Array<string | number>,
  rows: Array<Array<string | number | null | undefined>>
) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsView({
  invoices,
  invoiceItems,
  payments,
  customers,
  products,
  stockReport,
  timezone,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("sales");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [filterError, setFilterError] = useState("");
  const [exportType, setExportType] = useState<ExportType>("complete");

  const itemsByInvoice = useMemo(() => {
    const grouped = new Map<string, InvoiceReportLineItem[]>();
    for (const item of invoiceItems) {
      const items = grouped.get(item.invoice_id) || [];
      items.push(item);
      grouped.set(item.invoice_id, items);
    }
    return grouped;
  }, [invoiceItems]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([Number(dateKey(new Date(), timezone).slice(0, 4))]);
    for (const invoice of invoices) {
      years.add(Number(dateKey(invoice.created_at, timezone).slice(0, 4)));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, timezone]);

  const dateBounds = getDateBounds(applied, timezone);
  const filteredInvoices = useMemo(() => {
    const min = applied.minimum === "" ? null : Number(applied.minimum);
    const max = applied.maximum === "" ? null : Number(applied.maximum);

    return invoices.filter((invoice) => {
      const key = dateKey(invoice.created_at, timezone);
      const month = key.slice(5, 7);
      const year = key.slice(0, 4);
      if (dateBounds.start && key < dateBounds.start) return false;
      if (dateBounds.end && key > dateBounds.end) return false;
      if (applied.month && month !== applied.month.padStart(2, "0")) return false;
      if (applied.year && year !== applied.year) return false;
      if (min !== null && invoice.grand_total < min) return false;
      if (max !== null && invoice.grand_total > max) return false;
      if (
        applied.customerId &&
        !customerKeyMatches(invoice, applied.customerId)
      ) {
        return false;
      }
      if (
        applied.productId &&
        !(itemsByInvoice.get(invoice.id) || []).some((item) =>
          productKeyMatches(item, applied.productId)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [
    applied,
    dateBounds.start,
    dateBounds.end,
    invoices,
    itemsByInvoice,
    timezone,
  ]);

  const invoiceIdSet = useMemo(
    () => new Set(filteredInvoices.map((invoice) => invoice.id)),
    [filteredInvoices]
  );
  const filteredItems = useMemo(
    () =>
      invoiceItems.filter(
        (item) =>
          invoiceIdSet.has(item.invoice_id) &&
          (!applied.productId || productKeyMatches(item, applied.productId))
      ),
    [applied.productId, invoiceIdSet, invoiceItems]
  );

  const totalRevenue = filteredInvoices.reduce(
    (total, invoice) => total + invoice.grand_total,
    0
  );
  const averageInvoice = filteredInvoices.length
    ? totalRevenue / filteredInvoices.length
    : 0;
  const totalUnits = filteredItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const productSales = useMemo(() => {
    const groups = new Map<string, SalesGroup>();
    for (const item of filteredItems) {
      const id = item.product_id || `sku:${item.sku}`;
      const group = groups.get(id) || {
        name: item.product_name,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
        invoiceIds: new Set<string>(),
      };
      group.quantity += item.quantity;
      group.revenue += item.total_price;
      group.invoiceIds.add(item.invoice_id);
      groups.set(id, group);
    }
    return Array.from(groups.entries())
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [filteredItems]);

  const customerSales = useMemo(() => {
    const groups = new Map<string, SalesGroup>();
    for (const invoice of filteredInvoices) {
      const id =
        invoice.customer_id ||
        `snapshot:${invoice.customer_phone || ""}:${invoice.customer_name}`;
      const group = groups.get(id) || {
        name: invoice.customer_name,
        phone: invoice.customer_phone,
        quantity: 0,
        revenue: 0,
        invoiceIds: new Set<string>(),
      };
      group.revenue += invoice.grand_total;
      group.invoiceIds.add(invoice.id);
      group.quantity += (itemsByInvoice.get(invoice.id) || [])
        .filter(
          (item) =>
            !applied.productId ||
            productKeyMatches(item, applied.productId)
        )
        .reduce((sum, item) => sum + item.quantity, 0);
      groups.set(id, group);
    }
    return Array.from(groups.entries())
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [applied.productId, filteredInvoices, itemsByInvoice]);

  const paymentSummary = useMemo(() => {
    const groups = new Map<string, { count: number; amount: number }>();
    for (const payment of payments) {
      if (!invoiceIdSet.has(payment.invoice_id)) continue;
      const method = payment.payment_method.toLowerCase();
      const group = groups.get(method) || { count: 0, amount: 0 };
      group.count += 1;
      group.amount += payment.amount;
      groups.set(method, group);
    }
    const totalPayments = Array.from(groups.values()).reduce(
      (total, group) => total + group.amount,
      0
    );
    return Array.from(groups.entries())
      .map(([method, group]) => ({
        method,
        ...group,
        percentage:
          totalPayments > 0 ? (group.amount / totalPayments) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [invoiceIdSet, payments]);

  const breakdown = useMemo(() => {
    const dates = filteredInvoices.map((invoice) =>
      dateKey(invoice.created_at, timezone)
    );
    const span = dates.length
      ? (Date.parse(`${dates.reduce((max, value) => (value > max ? value : max))}T00:00:00Z`) -
          Date.parse(`${dates.reduce((min, value) => (value < min ? value : min))}T00:00:00Z`)) /
        86400000
      : 0;
    const granularity =
      applied.datePreset === "all" && applied.month
        ? "monthly"
        : applied.datePreset === "all" && applied.year
        ? "yearly"
        : span <= 62
        ? "daily"
        : span <= 730
        ? "monthly"
        : "yearly";
    const groups = new Map<string, { count: number; revenue: number }>();

    for (const invoice of filteredInvoices) {
      const key = dateKey(invoice.created_at, timezone);
      const groupKey =
        granularity === "daily"
          ? key
          : granularity === "monthly"
          ? key.slice(0, 7)
          : key.slice(0, 4);
      const group = groups.get(groupKey) || { count: 0, revenue: 0 };
      group.count += 1;
      group.revenue += invoice.grand_total;
      groups.set(groupKey, group);
    }

    return {
      granularity,
      rows: Array.from(groups.entries())
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.key.localeCompare(a.key)),
    };
  }, [
    applied.datePreset,
    applied.month,
    applied.year,
    filteredInvoices,
    timezone,
  ]);

  const customerSearch = draft.customerSearch.trim().toLowerCase();
  const visibleCustomers = customers.filter(
    (customer) =>
      !customerSearch ||
      customer.name.toLowerCase().includes(customerSearch) ||
      (customer.phone || "").toLowerCase().includes(customerSearch)
  );
  const productSearch = draft.productSearch.trim().toLowerCase();
  const visibleProducts = products.filter(
    (product) =>
      !productSearch ||
      product.name.toLowerCase().includes(productSearch) ||
      product.sku.toLowerCase().includes(productSearch)
  );

  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimum = draft.minimum === "" ? null : Number(draft.minimum);
    const maximum = draft.maximum === "" ? null : Number(draft.maximum);

    if (
      (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) ||
      (maximum !== null && (!Number.isFinite(maximum) || maximum < 0))
    ) {
      setFilterError("Enter valid non-negative minimum and maximum amounts.");
      return;
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      setFilterError("Minimum amount cannot exceed maximum amount.");
      return;
    }
    if (draft.datePreset === "custom") {
      if (!draft.fromDate || !draft.toDate) {
        setFilterError("Select both dates for the custom date range.");
        return;
      }
      if (draft.fromDate > draft.toDate) {
        setFilterError("The start date cannot be after the end date.");
        return;
      }
    }

    setFilterError("");
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFilterError("");
  }

  const activeFilters: string[] = [];
  if (applied.datePreset !== "all") {
    const labels: Record<DatePreset, string> = {
      all: "",
      today: "Today",
      yesterday: "Yesterday",
      last7: "Last 7 days",
      last30: "Last 30 days",
      custom: `${applied.fromDate} to ${applied.toDate}`,
    };
    activeFilters.push(labels[applied.datePreset]);
  }
  if (applied.month) activeFilters.push(MONTHS[Number(applied.month) - 1]);
  if (applied.year) activeFilters.push(applied.year);
  if (applied.customerId) {
    const customer = customers.find((entry) => entry.id === applied.customerId);
    activeFilters.push(`Customer: ${customer?.name || "Selected"}`);
  }
  if (applied.productId) {
    const product = products.find((entry) => entry.id === applied.productId);
    activeFilters.push(`Product: ${product?.name || "Selected"}`);
  }
  if (applied.minimum !== "") activeFilters.push(`Min: ${applied.minimum}`);
  if (applied.maximum !== "") activeFilters.push(`Max: ${applied.maximum}`);

  function getFilenameRange() {
    if (dateBounds.start && dateBounds.end) {
      return dateBounds.start === dateBounds.end
        ? dateBounds.start
        : `${dateBounds.start}_to_${dateBounds.end}`;
    }
    if (dateBounds.start) return `from_${dateBounds.start}`;
    if (dateBounds.end) return `through_${dateBounds.end}`;
    if (applied.month) {
      return `${MONTHS[Number(applied.month) - 1].toLowerCase()}-all-years`;
    }
    return "all-dates";
  }

  function exportFilteredData() {
    const range = getFilenameRange();
    const linesByInvoice = new Map<string, InvoiceReportLineItem[]>();
    for (const item of filteredItems) {
      const lines = linesByInvoice.get(item.invoice_id) || [];
      lines.push(item);
      linesByInvoice.set(item.invoice_id, lines);
    }

    if (exportType === "invoices") {
      const rows = filteredInvoices.map((invoice) => {
        const lines = linesByInvoice.get(invoice.id) || [];
        return [
          invoice.invoice_number,
          formatInvoiceDate(invoice.created_at, timezone),
          invoice.customer_name,
          invoice.customer_phone,
          lines.map((item) => item.product_name).join("; "),
          lines.map((item) => item.sku).join("; "),
          lines.reduce((sum, item) => sum + item.quantity, 0),
          invoice.subtotal.toFixed(2),
          invoice.discount_amount.toFixed(2),
          invoice.tax_amount.toFixed(2),
          invoice.grand_total.toFixed(2),
          invoice.payment_method,
          invoice.payment_status,
        ];
      });
      downloadCsv(
        `filtered-invoices-${range}.csv`,
        [
          "Invoice Number",
          "Invoice Date",
          "Customer Name",
          "Customer Phone",
          "Products",
          "SKUs",
          "Quantity",
          "Subtotal",
          "Discount",
          "GST/Tax",
          "Invoice Total",
          "Payment Method",
          "Payment Status",
        ],
        rows
      );
      return;
    }

    if (exportType === "products") {
      downloadCsv(
        `filtered-product-sales-${range}.csv`,
        [
          "Product Name",
          "SKU",
          "Quantity Sold",
          "Revenue",
          "Invoice Count",
          "Related Invoices",
          "Customers",
        ],
        productSales.map((product) => {
          const relatedInvoices = filteredInvoices.filter((invoice) =>
            product.invoiceIds.has(invoice.id)
          );
          return [
            product.name,
            product.sku,
            product.quantity,
            product.revenue.toFixed(2),
            product.invoiceIds.size,
            relatedInvoices.map((invoice) => invoice.invoice_number).join("; "),
            Array.from(
              new Set(relatedInvoices.map((invoice) => invoice.customer_name))
            ).join("; "),
          ];
        })
      );
      return;
    }

    if (exportType === "customers") {
      downloadCsv(
        `filtered-customer-sales-${range}.csv`,
        [
          "Customer Name",
          "Customer Phone",
          "Invoice Count",
          "Total Purchases",
          "Units Sold",
          "Invoice Numbers",
        ],
        customerSales.map((customer) => [
          customer.name,
          customer.phone,
          customer.invoiceIds.size,
          customer.revenue.toFixed(2),
          customer.quantity,
          filteredInvoices
            .filter((invoice) => customer.invoiceIds.has(invoice.id))
            .map((invoice) => invoice.invoice_number)
            .join("; "),
        ])
      );
      return;
    }

    const completeRows: Array<Array<string | number | null | undefined>> = [];
    for (const invoice of filteredInvoices) {
      const lines = linesByInvoice.get(invoice.id) || [];
      const exportLines = lines.length ? lines : [null];
      for (const item of exportLines) {
        const share =
          item && invoice.subtotal > 0 ? item.total_price / invoice.subtotal : 0;
        completeRows.push([
          invoice.invoice_number,
          formatInvoiceDate(invoice.created_at, timezone),
          invoice.customer_name,
          invoice.customer_phone,
          item?.product_name,
          item?.sku,
          item?.quantity,
          item?.unit_price.toFixed(2),
          item?.total_price.toFixed(2),
          item
            ? (invoice.discount_amount * share).toFixed(2)
            : invoice.discount_amount.toFixed(2),
          item ? (invoice.tax_amount * share).toFixed(2) : invoice.tax_amount.toFixed(2),
          invoice.grand_total.toFixed(2),
          invoice.payment_method,
          invoice.payment_status,
        ]);
      }
    }
    downloadCsv(
      `complete-filtered-report-${range}.csv`,
      [
        "Invoice Number",
        "Invoice Date",
        "Customer Name",
        "Customer Phone",
        "Product Name",
        "SKU",
        "Quantity",
        "Unit Price",
        "Line Revenue",
        "Discount Allocation",
        "GST/Tax Allocation",
        "Invoice Total",
        "Payment Method",
        "Payment Status",
      ],
      completeRows
    );

  }

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: "sales", label: "Sales Overview" },
    { id: "payments", label: "Payment Methods" },
    { id: "products", label: "Best-Sellers" },
    { id: "stock", label: "Stock Valuation" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">Advanced Filters</h2>
          <p className="mt-1 text-sm text-slate-500">
            Combine date, customer, product, and invoice-value criteria.
          </p>
        </div>

        <form onSubmit={applyFilters} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">
              Date range
              <select
                className={inputClass}
                value={draft.datePreset}
                onChange={(event) =>
                  updateDraft("datePreset", event.target.value as DatePreset)
                }
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="custom">Custom date range</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Month
              <select
                className={inputClass}
                value={draft.month}
                onChange={(event) => updateDraft("month", event.target.value)}
              >
                <option value="">All months</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={String(index + 1)}>
                    {month}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Year
              <select
                className={inputClass}
                value={draft.year}
                onChange={(event) => updateDraft("year", event.target.value)}
              >
                <option value="">All years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-xs font-semibold text-slate-700">
              Invoice total range
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  aria-label="Minimum invoice amount"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={draft.minimum}
                  onChange={(event) => updateDraft("minimum", event.target.value)}
                />
                <input
                  aria-label="Maximum invoice amount"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max"
                  value={draft.maximum}
                  onChange={(event) => updateDraft("maximum", event.target.value)}
                />
              </div>
            </div>

            {draft.datePreset === "custom" && (
              <>
                <label className="text-xs font-semibold text-slate-700">
                  From date
                  <input
                    className={inputClass}
                    type="date"
                    value={draft.fromDate}
                    onChange={(event) => updateDraft("fromDate", event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  To date
                  <input
                    className={inputClass}
                    type="date"
                    value={draft.toDate}
                    onChange={(event) => updateDraft("toDate", event.target.value)}
                  />
                </label>
              </>
            )}

            <div className="text-xs font-semibold text-slate-700">
              Customer
              <input
                className={inputClass}
                type="search"
                placeholder="Search name or phone"
                value={draft.customerSearch}
                onChange={(event) =>
                  updateDraft("customerSearch", event.target.value)
                }
              />
              <select
                aria-label="Select customer"
                className={inputClass}
                value={draft.customerId}
                onChange={(event) => updateDraft("customerId", event.target.value)}
              >
                <option value="">All customers</option>
                {visibleCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs font-semibold text-slate-700">
              Product
              <input
                className={inputClass}
                type="search"
                placeholder="Search product name or SKU"
                value={draft.productSearch}
                onChange={(event) => updateDraft("productSearch", event.target.value)}
              />
              <select
                aria-label="Select product"
                className={inputClass}
                value={draft.productId}
                onChange={(event) => updateDraft("productId", event.target.value)}
              >
                <option value="">All products</option>
                {visibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.sku}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filterError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {filterError}
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">
                {filteredInvoices.length} matching invoice
                {filteredInvoices.length === 1 ? "" : "s"}
              </span>
              {activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {filter}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1 sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Filtered report export type"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            value={exportType}
            onChange={(event) => setExportType(event.target.value as ExportType)}
          >
            <option value="complete">Complete filtered report</option>
            <option value="invoices">Filtered invoices</option>
            <option value="products">Filtered product sales</option>
            <option value="customers">Filtered customer sales</option>
          </select>
          <button
            type="button"
            onClick={exportFilteredData}
            disabled={!filteredInvoices.length}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Download className="h-4 w-4" />
            Export Filtered Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Sales Revenue"
          value={formatCurrency(totalRevenue)}
          detail={`${filteredInvoices.length} matching invoices`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="emerald"
        />
        <MetricCard
          label="Average Invoice Value"
          value={formatCurrency(averageInvoice)}
          detail="Revenue divided by matching invoices"
          icon={<FileSpreadsheet className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          label="Total Units Sold"
          value={totalUnits.toLocaleString()}
          detail={`${filteredItems.length} matching product lines`}
          icon={<Package className="h-4 w-4" />}
          color="purple"
        />
        <MetricCard
          label="Matching Invoices"
          value={filteredInvoices.length.toLocaleString()}
          detail="Based on all active filters"
          icon={<Calendar className="h-4 w-4" />}
          color="amber"
        />
      </div>

      {activeTab === "sales" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                {breakdown.granularity === "daily"
                  ? "Daily Sales Breakdown"
                  : breakdown.granularity === "monthly"
                  ? "Monthly Sales Breakdown"
                  : "Yearly Sales Breakdown"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sales cadence based on the filtered date span.
              </p>
            </div>
            <ReportTable
              headers={["Period", "Invoices", "Revenue", "Average Invoice"]}
              emptyMessage="No sales match the selected filters."
            >
              {breakdown.rows.map((row) => (
                <tr key={row.key} className="text-sm">
                  <td className="py-3 font-medium text-slate-800">
                    {breakdown.granularity === "daily"
                      ? formatDateKey(row.key)
                      : breakdown.granularity === "monthly"
                      ? new Date(`${row.key}-01T00:00:00`).toLocaleDateString(
                          undefined,
                          { month: "long", year: "numeric" }
                        )
                      : row.key}
                  </td>
                  <td className="py-3 text-center text-slate-600">{row.count}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="py-3 text-right text-slate-600">
                    {formatCurrency(row.revenue / row.count)}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Customer Purchase Summary
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Invoices and total purchases in the filtered dataset.
              </p>
            </div>
            <ReportTable
              headers={["Customer", "Phone", "Invoices", "Units", "Total Purchases"]}
              emptyMessage="No customer purchases match the selected filters."
            >
              {customerSales.map((customer) => (
                <tr key={customer.id} className="text-sm">
                  <td className="py-3 font-medium text-slate-800">
                    {customer.name}
                  </td>
                  <td className="py-3 text-slate-600">{customer.phone || "-"}</td>
                  <td className="py-3 text-center text-slate-600">
                    {customer.invoiceIds.size}
                  </td>
                  <td className="py-3 text-center text-slate-600">
                    {customer.quantity}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(customer.revenue)}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </section>
        </div>
      )}

      {activeTab === "payments" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Payment Method Distribution
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Recorded payment amounts from matching invoices, grouped by method.
            </p>
          </div>
          {paymentSummary.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paymentSummary.map((payment) => {
                const Icon =
                  payment.method === "cash"
                    ? Banknote
                    : payment.method === "upi"
                    ? QrCode
                    : CreditCard;
                return (
                  <div
                    key={payment.method}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-bold capitalize text-slate-800">
                        <Icon className="h-4 w-4 text-blue-600" />
                        {payment.method}
                      </span>
                      <span className="text-xs font-semibold text-blue-700">
                        {payment.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-bold text-slate-900">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {payment.count} payments
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${payment.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No payment data matches the selected filters.
            </p>
          )}
        </section>
      )}

      {activeTab === "products" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Best-Selling Products
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Quantities and line revenue from matching invoices.
            </p>
          </div>
          <ReportTable
            headers={["Product Name", "SKU", "Units Sold", "Revenue", "Invoices"]}
            emptyMessage="No product sales match the selected filters."
          >
            {productSales.map((product) => (
              <tr key={product.id} className="text-sm">
                <td className="py-3 font-medium text-slate-800">
                  {product.name}
                </td>
                <td className="py-3 font-mono text-xs text-blue-700">
                  {product.sku}
                </td>
                <td className="py-3 text-center font-semibold text-slate-800">
                  {product.quantity}
                </td>
                <td className="py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(product.revenue)}
                </td>
                <td className="py-3 text-center text-slate-600">
                  {product.invoiceIds.size}
                </td>
              </tr>
            ))}
          </ReportTable>
        </section>
      )}

      {activeTab === "stock" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Stock Valuation & Inventory Assets
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Current inventory is independent of historical sales filters.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `stock-valuation-${getFilenameRange()}.csv`,
                  [
                    "Product Name",
                    "SKU",
                    "Current Stock",
                    "Selling Price",
                    "Purchase Cost",
                    "Inventory Value",
                  ],
                  stockReport.map((product) => [
                    product.name,
                    product.sku,
                    product.stock_quantity,
                    product.selling_price.toFixed(2),
                    product.purchase_price.toFixed(2),
                    (product.stock_quantity * product.selling_price).toFixed(2),
                  ])
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-blue-600" />
              Download Stock Report
            </button>
          </div>
          <ReportTable
            headers={[
              "Product Name",
              "SKU",
              "Stock Count",
              "Selling Price",
              "Purchase Cost",
              "Retail Asset Value",
            ]}
            emptyMessage="No active products found."
          >
            {stockReport.map((product) => (
              <tr key={product.id} className="text-sm">
                <td className="py-3 font-medium text-slate-800">
                  {product.name}
                </td>
                <td className="py-3 font-mono text-xs text-blue-700">
                  {product.sku}
                </td>
                <td className="py-3 text-center text-slate-700">
                  {product.stock_quantity}
                </td>
                <td className="py-3 text-right text-slate-700">
                  {formatCurrency(product.selling_price)}
                </td>
                <td className="py-3 text-right text-slate-700">
                  {formatCurrency(product.purchase_price)}
                </td>
                <td className="py-3 text-right font-semibold text-slate-900">
                  {formatCurrency(product.stock_quantity * product.selling_price)}
                </td>
              </tr>
            ))}
          </ReportTable>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "purple" | "amber";
}) {
  const iconClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClasses[color]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ReportTable({
  headers,
  emptyMessage,
  children,
}: {
  headers: string[];
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {headers.map((header, index) => (
              <th
                key={header}
                className={`pb-3 ${index > 1 ? "text-right" : ""} ${
                  header === "Invoices" || header === "Units" || header === "Units Sold"
                    ? "text-center"
                    : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="py-10 text-center text-sm text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
