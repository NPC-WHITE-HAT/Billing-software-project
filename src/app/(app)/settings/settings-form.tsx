"use client";

import { useState, type FormEvent } from "react";
import { updateStoreSettings } from "./actions";
import {
  Building2,
  FileText,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Percent,
} from "lucide-react";

interface Props {
  initialData: {
    businessName: string;
    category: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    gstin: string;
    currency: string;
    timezone: string;
    invoicePrefix: string;
    invoiceSequence: number;
    taxRate: number;
    taxLabel: string;
    allowNegativeStock: boolean;
    whatsappConfigured: boolean;
  };
}

export default function SettingsForm({ initialData }: Props) {
  const [businessName, setBusinessName] = useState(initialData.businessName);
  const [phone, setPhone] = useState(initialData.phone);
  const [email, setEmail] = useState(initialData.email);
  const [address, setAddress] = useState(initialData.address);
  const [city, setCity] = useState(initialData.city);
  const [state, setState] = useState(initialData.state);
  const [pincode, setPincode] = useState(initialData.pincode);
  const [gstin, setGstin] = useState(initialData.gstin);
  const [invoicePrefix, setInvoicePrefix] = useState(initialData.invoicePrefix);
  const [taxRate, setTaxRate] = useState(String(initialData.taxRate));
  const [taxLabel, setTaxLabel] = useState(initialData.taxLabel);
  const [allowNegativeStock, setAllowNegativeStock] = useState(
    initialData.allowNegativeStock
  );

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError("");
    setLoading(true);

    try {
      const res = await updateStoreSettings({
        businessName,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        gstin,
        invoicePrefix,
        taxRate: parseFloat(taxRate) || 0,
        taxLabel,
        allowNegativeStock,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Shop settings updated successfully.</span>
        </div>
      )}

      {/* Section 1: Store Profile */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
          <Building2 className="w-4 h-4" />
          <span>Store Profile & Tax Info</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Store Name *
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Store Phone *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Shop Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              GSTIN
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="33AAAAA0000A1Z5"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Street Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              State & PIN
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="PIN"
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Invoicing & Inventory Policy */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
          <FileText className="w-4 h-4" />
          <span>Invoicing & Inventory Rules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Invoice Prefix
            </label>
            <input
              type="text"
              required
              maxLength={8}
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Next invoice: {invoicePrefix}-
              {String(initialData.invoiceSequence).padStart(6, "0")}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Tax Rate (%)
            </label>
            <div className="relative">
              <Percent className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Tax Label
            </label>
            <input
              type="text"
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
              placeholder="GST"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Negative Stock Toggle */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">
              Allow Negative Stock Invoicing
            </span>
            <span className="text-xs text-slate-400">
              When disabled, cashiers cannot bill items whose stock count is zero.
            </span>
          </div>
          <input
            type="checkbox"
            checked={allowNegativeStock}
            onChange={(e) => setAllowNegativeStock(e.target.checked)}
            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600"
          />
        </div>
      </div>

      {/* Section 3: WhatsApp Cloud Integration Status */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wider">
          <MessageSquare className="w-4 h-4" />
          <span>Meta WhatsApp Cloud API Status</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  initialData.whatsappConfigured ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {initialData.whatsappConfigured
                  ? "Meta Cloud API Connected"
                  : "Environment Config Pending"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {initialData.whatsappConfigured
                ? "Utility template invoice delivery is operational."
                : "Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in your environment to enable live dispatch."}
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-md bg-slate-800 text-slate-300">
            v21.0 Cloud Graph
          </span>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Save Store Settings</span>
        </button>
      </div>
    </form>
  );
}

