"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface SettingsUpdateInput {
  businessName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  invoicePrefix: string;
  taxRate: number;
  taxLabel: string;
  allowNegativeStock: boolean;
}

export async function updateStoreSettings(input: SettingsUpdateInput) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  if (context.membership.role !== "owner") {
    return { error: "Only the store owner can modify business settings." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  if (!input.businessName || input.businessName.trim().length < 2) {
    return { error: "Valid store name required." };
  }

  // 1. Update businesses table
  const { error: bizErr } = await supabase
    .from("businesses")
    .update({
      name: input.businessName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      pincode: input.pincode?.trim() || null,
      gstin: input.gstin?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (bizErr) {
    return { error: bizErr.message };
  }

  // 2. Update business_settings table
  const { error: setErr } = await supabase
    .from("business_settings")
    .update({
      invoice_prefix: input.invoicePrefix.trim().toUpperCase(),
      tax_rate: Number(input.taxRate ?? 0),
      tax_label: input.taxLabel.trim() || "GST",
      allow_negative_stock: Boolean(input.allowNegativeStock),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (setErr) {
    return { error: setErr.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/billing");

  return { success: true };
}
