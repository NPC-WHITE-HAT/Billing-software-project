import { createClient } from "./supabase/server";

export interface CurrentBusinessContext {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  business: {
    id: string;
    name: string;
    category: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
    currency: string;
    timezone: string;
  };
  membership: {
    role: "owner" | "admin" | "manager" | "cashier";
  };
  settings: {
    invoicePrefix: string;
    invoiceSequence: number;
    taxRate: number;
    taxLabel: string;
    allowNegativeStock: boolean;
    whatsappEnabled: boolean;
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

export async function getCurrentBusinessContext(): Promise<CurrentBusinessContext | null> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // 1. Fetch business membership for this user
  const { data: members, error: memberError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (memberError || !members || members.length === 0) {
    return null;
  }

  const membership = members[0];
  const businessId = membership.business_id;

  // 2. Fetch business details
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (bizError || !business) {
    return null;
  }

  // 3. Fetch settings
  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  // 4. Fetch profile (if exists, or fallback to user metadata)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = profile?.full_name || (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User";

  return {
    user: {
      id: user.id,
      email: user.email || "",
      fullName,
    },
    business: {
      id: business.id,
      name: business.name,
      category: business.category,
      phone: business.phone,
      email: business.email,
      address: business.address,
      city: business.city,
      state: business.state,
      pincode: business.pincode,
      gstin: business.gstin,
      currency: business.currency || "INR",
      timezone: business.timezone || "Asia/Kolkata",
    },
    membership: {
      role: membership.role as CurrentBusinessContext["membership"]["role"],
    },
    settings: {
      invoicePrefix: settings?.invoice_prefix || "INV",
      invoiceSequence: settings?.invoice_sequence ?? 1,
      taxRate: Number(settings?.tax_rate ?? 0),
      taxLabel: settings?.tax_label || "GST",
      allowNegativeStock: Boolean(settings?.allow_negative_stock),
      whatsappEnabled: Boolean(settings?.whatsapp_enabled),
    },
  };
}

