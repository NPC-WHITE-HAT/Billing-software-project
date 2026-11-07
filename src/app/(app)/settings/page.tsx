import { redirect } from "next/navigation";
import { getCurrentBusinessContext } from "@/lib/auth";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import SettingsForm from "./settings-form";

export const metadata = {
  title: "Shop Settings | Qelanto Business OS",
};

export default async function SettingsPage() {
  const context = await getCurrentBusinessContext();
  if (!context) {
    redirect("/onboarding");
  }
  if (context.membership.role !== "owner") {
    redirect("/dashboard");
  }

  const whatsappConfigured = isWhatsAppConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Shop Preferences & Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage business identity, GST tax percentage, invoice numbering and cloud integrations
        </p>
      </div>

      <SettingsForm
        initialData={{
          businessName: context.business.name,
          category: context.business.category,
          phone: context.business.phone || "",
          email: context.business.email || "",
          address: context.business.address || "",
          city: context.business.city || "",
          state: context.business.state || "",
          pincode: context.business.pincode || "",
          gstin: context.business.gstin || "",
          currency: context.business.currency,
          timezone: context.business.timezone,
          invoicePrefix: context.settings.invoicePrefix,
          invoiceSequence: context.settings.invoiceSequence,
          taxRate: context.settings.taxRate,
          taxLabel: context.settings.taxLabel,
          allowNegativeStock: context.settings.allowNegativeStock,
          whatsappConfigured,
        }}
      />
    </div>
  );
}
