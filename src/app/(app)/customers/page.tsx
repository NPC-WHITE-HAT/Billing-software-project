import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CustomerTable from "./customer-table";

export const metadata = {
  title: "Customers Directory | Qelanto Business OS",
};

export default async function CustomersPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address, whatsapp_consent")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Customer Management
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Client profiles, order history, and WhatsApp invoicing consents
        </p>
      </div>

      <CustomerTable initialCustomers={customers || []} />
    </div>
  );
}

