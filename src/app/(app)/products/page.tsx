import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductTable from "./product-table";

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
  title: "Products Catalog | Qelanto Business OS",
};

export default async function ProductsPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  // Fetch products with category relation
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, category_id, selling_price, purchase_price, stock_quantity, low_stock_threshold, category:categories!qelanto_products_category_business_fk(id, name)")
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
      console.error("[products] Product query failed", queryResult);
    } else {
      console.info("[products] Product query succeeded", queryResult);
    }
  }

  if (productsError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p className="font-semibold">Unable to load products.</p>
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
      ...p,
      selling_price: Number(p.selling_price),
      purchase_price: Number(p.purchase_price || 0),
      stock_quantity: Number(p.stock_quantity),
      low_stock_threshold: Number(p.low_stock_threshold),
      category: cat || null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Products & Inventory Catalog
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage shop apparel, pricing, barcodes/SKUs and stock thresholds
        </p>
      </div>

      <ProductTable
        initialProducts={formattedProducts}
        categories={categories || []}
      />
    </div>
  );
}

