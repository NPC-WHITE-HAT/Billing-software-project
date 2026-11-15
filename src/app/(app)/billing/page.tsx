import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PosTerminal from "./pos-terminal";

function formatDiagnosticValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch (error) {
      if (error instanceof TypeError) {
        return "[Unserializable value]";
      }
      throw error;
    }
  }
  return String(value);
}

export const metadata = {
  title: "POS Billing Terminal | Qelanto Business OS",
};

export default async function BillingPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  // 1. Fetch active products with category names
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, category_id, selling_price, stock_quantity, category:categories!qelanto_products_category_business_fk(name)")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (process.env.NODE_ENV === "development") {
    const queryResult = {
      businessId,
      productCount: products?.length ?? null,
      error: productsError
        ? {
            message: productsError.message,
            code: productsError.code,
            details: productsError.details,
            hint: productsError.hint,
            status:
              "status" in productsError ? productsError.status : undefined,
          }
        : null,
    };

    if (productsError) {
      console.error("[billing] Product query failed", queryResult);
    } else {
      console.info("[billing] Product query succeeded", queryResult);
    }
  }

  if (productsError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p className="font-semibold">Unable to load products for the POS.</p>
        {process.env.NODE_ENV === "development" && (
          <div className="mt-2 space-y-1 text-xs">
            <p>Business ID: {businessId}</p>
            <p>Message: {formatDiagnosticValue(productsError.message)}</p>
            <p>Code: {formatDiagnosticValue(productsError.code)}</p>
            <pre className="whitespace-pre-wrap break-words">
              Details: {formatDiagnosticValue(productsError.details)}
            </pre>
            <pre className="whitespace-pre-wrap break-words">
              Hint: {formatDiagnosticValue(productsError.hint)}
            </pre>
            <p>
              Status:{" "}
              {formatDiagnosticValue(
                "status" in productsError ? productsError.status : undefined
              )}
            </p>
          </div>
        )}
      </div>
    );
  }

  const formattedProducts = (products || []).map((p) => {
    const cat = Array.isArray(p.category) ? p.category[0] : p.category;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category_id: p.category_id,
      category_name: cat?.name || "General",
      selling_price: Number(p.selling_price),
      stock_quantity: Number(p.stock_quantity),
    };
  });

  // 2. Fetch customers
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address, whatsapp_consent")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  return (
    <div className="-m-4 min-h-full space-y-4 bg-slate-50 p-4 sm:-m-6 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Checkout workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Retail POS Terminal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {context.business.name} &bull; Counter Checkout & Rapid Invoicing
          </p>
        </div>
      </div>

      <PosTerminal
        initialProducts={formattedProducts}
        initialCustomers={customers || []}
        taxRate={context.settings.taxRate}
        taxLabel={context.settings.taxLabel}
        currency={context.business.currency}
        allowNegativeStock={context.settings.allowNegativeStock}
      />
    </div>
  );
}
