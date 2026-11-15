"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBusinessOnboarding } from "./actions";
import {
  Store,
  MapPin,
  Building2,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Percent,
} from "lucide-react";

interface Props {
  userEmail: string;
}

export default function OnboardingForm({ userEmail }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Retail / Clothing");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [taxRate, setTaxRate] = useState("0");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Please enter your shop name.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Please enter a shop contact phone number.");
      return;
    }

    setLoading(true);

    try {
      const res = await createBusinessOnboarding({
        name,
        category,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        gstin,
        invoicePrefix,
        taxRate: parseFloat(taxRate) || 0,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to set up shop."
      );
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl sm:p-8">
      <div className="mb-6 text-center sm:mb-8">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-600/10 text-blue-500">
          <Store className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-blue-700">Qelanto Business OS</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
          Set Up Your Retail Store
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure your shop profile, location and invoicing preferences.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>Store configured successfully! Launching your POS workspace...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Shop Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Store Profile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Business / Store Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Trendz Fashion Store"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Business Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Retail / Clothing">Clothing & Apparel</option>
                <option value="Footwear & Shoes">Footwear & Shoes</option>
                <option value="General Retail">General Retail & Mart</option>
                <option value="Electronics & Accessories">Electronics & Mobile</option>
                <option value="Jewelry & Watches">Jewelry & Watches</option>
                <option value="Other Retail">Other Retail</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Shop Billing Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@yourstore.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Address & Tax Details */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            <span>Store Address & Tax</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. 12, Commercial Complex, Main Road"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                City / Town
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Coimbatore"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Tamil Nadu"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                PIN Code
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="641001"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="33AAAAA0000A1Z5"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Billing & Regional Config */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Billing Defaults</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Currency
              </label>
              <input
                type="text"
                disabled
                value="INR (₹) - Indian Rupee"
                className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Timezone
              </label>
              <input
                type="text"
                disabled
                value="Asia/Kolkata (IST)"
                className="w-full rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                placeholder="INV"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Invoices will be formatted as: {invoicePrefix}-000001
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Default GST / Tax Rate (%)
              </label>
              <div className="relative">
                <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-10 pr-4 py-2.5 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="5">5% (Standard Apparels &lt; ₹1,000)</option>
                  <option value="12">12% (Apparels &gt; ₹1,000)</option>
                  <option value="18">18% (Standard GST)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing Store Workspace...
            </>
          ) : (
            <>
              Complete Onboarding & Enter OS
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

