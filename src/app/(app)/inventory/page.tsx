import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import InventoryView, { InventoryProduct, InventoryMovement } from "./inventory-view";

export const metadata = {
  title: "Inventory & Stock Audit | Qelanto Business OS",
};

export default async function InventoryPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  // 1. Fetch active products with categories
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, category_id, selling_price, stock_quantity, low_stock_threshold, category:categories!qelanto_products_category_business_fk(name)")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("stock_quantity", { ascending: true });

  const formattedProducts: InventoryProduct[] = (products || []).map((p) => {
    const cat = Array.isArray(p.category) ? p.category[0] : p.category;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category_name: cat?.name || "General",
      selling_price: Number(p.selling_price),
      stock_quantity: Number(p.stock_quantity),
      low_stock_threshold: Number(p.low_stock_threshold),
    };
  });

  // 2. Fetch recent inventory movements
  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("id, product_id, type, quantity_delta, previous_stock, new_stock, notes, created_at, product:products(name, sku)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  const formattedMovements: InventoryMovement[] = (movements || []).map((m) => {
    const prod = Array.isArray(m.product) ? m.product[0] : m.product;
    return {
      id: m.id,
      product_id: m.product_id,
      type: m.type,
      quantity_delta: m.quantity_delta,
      previous_stock: m.previous_stock,
      new_stock: m.new_stock,
      notes: m.notes,
      created_at: m.created_at,
      product_name: prod?.name,
      product_sku: prod?.sku,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Inventory Control & Stock Auditing
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Track stock levels, replenish inventory batches, and inspect automated ledger trails
        </p>
      </div>

      <InventoryView
        products={formattedProducts}
        movements={formattedMovements}
        allowNegativeStock={context.settings.allowNegativeStock}
        userRole={context.membership.role}
      />
    </div>
  );
}

