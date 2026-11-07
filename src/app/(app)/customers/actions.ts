"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface CustomerFormData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  whatsappConsent: boolean;
}

export async function createCustomer(data: CustomerFormData) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  if (!data.name || data.name.trim().length < 2) {
    return { error: "Customer name must be at least 2 characters." };
  }

  const phone = data.phone.trim().replace(/\s+/g, "");
  if (!phone || phone.length < 7) {
    return { error: "Please enter a valid phone number." };
  }

  // Check phone uniqueness within business
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return { error: `Customer with phone number ${phone} is already registered.` };
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      name: data.name.trim(),
      phone,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      whatsapp_consent: Boolean(data.whatsappConsent),
    })
    .select()
    .single();

  if (error || !customer) {
    return { error: error?.message || "Failed to create customer." };
  }

  revalidatePath("/customers");
  revalidatePath("/billing");
  return { success: true, customer };
}

export async function updateCustomer(id: string, data: CustomerFormData) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  if (!data.name || data.name.trim().length < 2) {
    return { error: "Customer name must be at least 2 characters." };
  }

  const phone = data.phone.trim().replace(/\s+/g, "");
  if (!phone || phone.length < 7) {
    return { error: "Please enter a valid phone number." };
  }

  // Check phone conflict
  const { data: conflict } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .neq("id", id)
    .maybeSingle();

  if (conflict) {
    return { error: `Phone number ${phone} is already used by another customer.` };
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: data.name.trim(),
      phone,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      whatsapp_consent: Boolean(data.whatsappConsent),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/billing");
  return { success: true };
}

export async function getCustomerInvoices(customerId: string) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, subtotal, discount_amount, tax_amount, grand_total, payment_status, created_at, items:invoice_items(*)")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { success: true, invoices: invoices || [] };
}

