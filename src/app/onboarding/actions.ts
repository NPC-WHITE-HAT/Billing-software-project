"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface OnboardingInput {
  name: string;
  category: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  invoicePrefix?: string;
  taxRate?: number;
}

export async function createBusinessOnboarding(input: OnboardingInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required. Please sign in." };
  }

  // Validate inputs
  const trimmedName = input.name?.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { error: "Please enter a valid shop or store name (at least 2 characters)." };
  }

  const trimmedPhone = input.phone?.trim();
  if (!trimmedPhone || trimmedPhone.length < 7) {
    return { error: "Please enter a valid contact phone number." };
  }

  const category = input.category?.trim() || "Retail / Clothing";
  const email = input.email?.trim() || user.email || null;
  const address = input.address?.trim() || null;
  const city = input.city?.trim() || null;
  const state = input.state?.trim() || null;
  const pincode = input.pincode?.trim() || null;
  const gstin = input.gstin?.trim() || null;
  const invoicePrefix = (input.invoicePrefix || "INV").trim().toUpperCase();
  const taxRate = Number(input.taxRate ?? 0);

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return { error: "Tax rate must be a number between 0 and 100." };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_business_onboarding_atomic",
    {
      p_name: trimmedName,
      p_category: category,
      p_phone: trimmedPhone,
      p_email: email,
      p_address: address,
      p_city: city,
      p_state: state,
      p_pincode: pincode,
      p_gstin: gstin,
      p_invoice_prefix: invoicePrefix,
      p_tax_rate: taxRate,
    }
  );

  if (rpcError) {
    return {
      error: `Store setup failed. No business was created. Database detail: ${rpcError.message}`,
    };
  }

  if (!rpcData?.success || !rpcData.business_id) {
    return {
      error: rpcData?.message || "Store setup failed. The onboarding procedure returned no business ID.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath("/onboarding");

  return {
    success: true,
    businessId: rpcData.business_id,
  };
}
