import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ProductTable from "./product-table";

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
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, category_id, selling_price, purchase_price, stock_quantity, low_stock_threshold, category:categories(id, name)")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name", { ascending: true });

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

