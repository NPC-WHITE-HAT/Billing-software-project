"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface StockAdjustmentInput {
  productId: string;
  quantityDelta: number;
  type: "restock" | "adjustment" | "return";
  notes?: string;
}

export async function adjustStock(input: StockAdjustmentInput) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;
  const userId = context.user.id;

  const delta = Math.floor(Number(input.quantityDelta));
  if (isNaN(delta) || delta === 0) {
    return { error: "Please specify a non-zero quantity change." };
  }

  // 1. Fetch current product
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, name, sku, stock_quantity")
    .eq("id", input.productId)
    .eq("business_id", businessId)
    .single();

  if (prodErr || !product) {
    return { error: "Product not found." };
  }

  const prevStock = Number(product.stock_quantity || 0);
  const newStock = prevStock + delta;

  if (!context.settings.allowNegativeStock && newStock < 0) {
    return {
      error: `Cannot reduce stock below zero. Current stock is ${prevStock}, requested reduction: ${Math.abs(delta)}.`,
    };
  }

  // 2. Update product stock
  const { error: updateErr } = await supabase
    .from("products")
    .update({
      stock_quantity: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id)
    .eq("business_id", businessId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  // 3. Insert audit log in inventory_movements
  const { error: moveErr } = await supabase.from("inventory_movements").insert({
    business_id: businessId,
    product_id: product.id,
    type: input.type,
    quantity_delta: delta,
    previous_stock: prevStock,
    new_stock: newStock,
    notes: input.notes?.trim() || `${input.type === "restock" ? "Stock replenishment" : "Manual inventory adjustment"}`,
    created_by: userId,
  });

  if (moveErr) {
    console.error("Warning: Could not record inventory movement:", moveErr);
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/billing");

  return { success: true, newStock };
}

export async function updateNegativeStockSetting(allow: boolean) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  if (context.membership.role !== "owner" && context.membership.role !== "admin") {
    return { error: "Only shop owners/admins can alter negative stock policies." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const { error } = await supabase
    .from("business_settings")
    .update({
      allow_negative_stock: Boolean(allow),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  revalidatePath("/settings");
  revalidatePath("/billing");

  return { success: true };
}

