"use client";

import { useState, type FormEvent } from "react";
import { createCustomer, updateCustomer, CustomerFormData } from "./actions";
import { X, Loader2, AlertCircle, MessageSquare } from "lucide-react";

export interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  whatsapp_consent: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: CustomerItem | null;
  onCreated?: (customer: CustomerItem) => void;
}

function CustomerFormInner({
  customerToEdit,
  onClose,
  onCreated,
}: {
  customerToEdit?: CustomerItem | null;
  onClose: () => void;
  onCreated?: (customer: CustomerItem) => void;
}) {
  const isEditing = Boolean(customerToEdit);

  const [name, setName] = useState(customerToEdit?.name || "");
  const [phone, setPhone] = useState(customerToEdit?.phone || "");
  const [email, setEmail] = useState(customerToEdit?.email || "");
  const [address, setAddress] = useState(customerToEdit?.address || "");
  const [whatsappConsent, setWhatsappConsent] = useState(
    customerToEdit ? Boolean(customerToEdit.whatsapp_consent) : true
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: CustomerFormData = {
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
        whatsappConsent,
      };

      if (isEditing && customerToEdit) {
        const res = await updateCustomer(customerToEdit.id, payload);
        if (res.error) {
          setError(res.error);
          setLoading(false);
          return;
        }
      } else {
        const res = await createCustomer(payload);
        if (res.error) {
          setError(res.error);
          setLoading(false);
          return;
        }
        if (res.customer) {
          onCreated?.(res.customer);
        }
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving customer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white">
          {isEditing ? "Edit Customer Details" : "Register New Customer"}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ananya Sharma"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Phone Number (WhatsApp) *
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Email (Optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ananya@example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
            Address / Area (Optional)
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Gandhi Nagar, 2nd Cross"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* WhatsApp Consent */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-800/40">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappConsent}
              onChange={(e) => setWhatsappConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Customer consented to WhatsApp receipts
              </span>
              <p className="text-slate-400 mt-0.5">
                Allows sending official utility invoice PDFs directly to customer&apos;s WhatsApp.
              </p>
            </div>
          </label>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEditing ? "Save Changes" : "Save Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CustomerDialog({
  isOpen,
  onClose,
  customerToEdit,
  onCreated,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <CustomerFormInner
        key={customerToEdit?.id || "new-customer"}
        customerToEdit={customerToEdit}
        onClose={onClose}
        onCreated={onCreated}
      />
    </div>
  );
}
