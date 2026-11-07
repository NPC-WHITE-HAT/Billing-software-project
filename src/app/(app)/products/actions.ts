"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ProductFormData {
  name: string;
  sku: string;
  categoryId?: string | null;
  sellingPrice: number;
  purchasePrice?: number;
  stockQuantity: number;
  lowStockThreshold?: number;
}

export async function createProduct(data: ProductFormData) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized: Business context missing." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;
  const userId = context.user.id;

  if (!data.name || data.name.trim().length < 2) {
    return { error: "Product name must be at least 2 characters." };
  }

  const sku = (data.sku || "").trim().toUpperCase();
  if (!sku) {
    return { error: "Product SKU / Barcode is required." };
  }

  const sellingPrice = Number(data.sellingPrice);
  if (isNaN(sellingPrice) || sellingPrice < 0) {
    return { error: "Valid selling price is required." };
  }

  const purchasePrice = Number(data.purchasePrice || 0);
  const stockQuantity = Math.floor(Number(data.stockQuantity || 0));
  const lowStockThreshold = Math.floor(Number(data.lowStockThreshold ?? 5));

  // Check SKU uniqueness in this business
  const { data: existingSku } = await supabase
    .from("products")
    .select("id")
    .eq("business_id", businessId)
    .eq("sku", sku)
    .maybeSingle();

  if (existingSku) {
    return { error: `A product with SKU "${sku}" already exists.` };
  }

  // Insert product
  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      name: data.name.trim(),
      sku,
      category_id: data.categoryId || null,
      selling_price: sellingPrice,
      purchase_price: purchasePrice,
      stock_quantity: stockQuantity,
      low_stock_threshold: lowStockThreshold,
      is_active: true,
    })
    .select()
    .single();

  if (insertError || !product) {
    return { error: insertError?.message || "Failed to create product." };
  }

  // Record initial stock movement if initial stock > 0
  if (stockQuantity > 0) {
    await supabase.from("inventory_movements").insert({
      business_id: businessId,
      product_id: product.id,
      type: "restock",
      quantity_delta: stockQuantity,
      previous_stock: 0,
      new_stock: stockQuantity,
      notes: "Initial inventory setup",
      created_by: userId,
    });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/billing");

  return { success: true, product };
}

export async function updateProduct(id: string, data: ProductFormData) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized: Business context missing." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;
  const userId = context.user.id;

  if (!data.name || data.name.trim().length < 2) {
    return { error: "Product name must be at least 2 characters." };
  }

  const sku = (data.sku || "").trim().toUpperCase();
  if (!sku) {
    return { error: "Product SKU is required." };
  }

  // Check SKU conflict with another product
  const { data: conflict } = await supabase
    .from("products")
    .select("id")
    .eq("business_id", businessId)
    .eq("sku", sku)
    .neq("id", id)
    .maybeSingle();

  if (conflict) {
    return { error: `SKU "${sku}" is already in use by another product.` };
  }

  // Fetch current product to check stock change
  const { data: currentProduct, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !currentProduct) {
    return { error: "Product not found." };
  }

  const sellingPrice = Number(data.sellingPrice);
  const purchasePrice = Number(data.purchasePrice || 0);
  const newStock = Math.floor(Number(data.stockQuantity || 0));
  const lowStockThreshold = Math.floor(Number(data.lowStockThreshold ?? 5));
  const currentStock = Number(currentProduct.stock_quantity || 0);

  const { error: updateError } = await supabase
    .from("products")
    .update({
      name: data.name.trim(),
      sku,
      category_id: data.categoryId || null,
      selling_price: sellingPrice,
      purchase_price: purchasePrice,
      stock_quantity: newStock,
      low_stock_threshold: lowStockThreshold,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", businessId);

  if (updateError) {
    return { error: updateError.message };
  }

  // If manual stock quantity was modified, record an adjustment
  if (newStock !== currentStock) {
    const delta = newStock - currentStock;
    await supabase.from("inventory_movements").insert({
      business_id: businessId,
      product_id: id,
      type: "adjustment",
      quantity_delta: delta,
      previous_stock: currentStock,
      new_stock: newStock,
      notes: "Manual stock adjustment in product editor",
      created_by: userId,
    });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/billing");

  return { success: true };
}

export async function archiveProduct(id: string) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const { error } = await supabase
    .from("products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/billing");

  return { success: true };
}

export async function createCategory(name: string, description?: string) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Category name is required." };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      business_id: businessId,
      name: trimmed,
      description: description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  return { success: true, category: data };
}

