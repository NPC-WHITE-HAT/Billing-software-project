import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PosTerminal from "./pos-terminal";

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
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, category_id, selling_price, stock_quantity, category:categories(name)")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name", { ascending: true });

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Retail POS Terminal
          </h1>
          <p className="text-xs text-slate-400">
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

