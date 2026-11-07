"use client";

import { useState, useMemo } from "react";
import CustomerDialog, { CustomerItem } from "./customer-dialog";
import CustomerHistoryModal from "./customer-history-modal";
import {
  Search,
  Plus,
  Edit,
  History,
  Users,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

interface Props {
  initialCustomers: CustomerItem[];
}

export default function CustomerTable({ initialCustomers }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [consentFilter, setConsentFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerItem | null>(null);

  const [historyCustomer, setHistoryCustomer] = useState<CustomerItem | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    return initialCustomers.filter((c) => {
      const matchSearch =
        !searchTerm.trim() ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm);

      const matchConsent =
        consentFilter === "all" ||
        (consentFilter === "consented" && c.whatsapp_consent) ||
        (consentFilter === "no-consent" && !c.whatsapp_consent);

      return matchSearch && matchConsent;
    });
  }, [initialCustomers, searchTerm, consentFilter]);

  function handleOpenCreate() {
    setCustomerToEdit(null);
    setIsDialogOpen(true);
  }

  function handleOpenEdit(cust: CustomerItem) {
    setCustomerToEdit(cust);
    setIsDialogOpen(true);
  }

  function handleOpenHistory(cust: CustomerItem) {
    setHistoryCustomer(cust);
    setIsHistoryOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name or phone..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
            <select
              value={consentFilter}
              onChange={(e) => setConsentFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Customers</option>
              <option value="consented" className="bg-slate-900">WhatsApp Opt-in</option>
              <option value="no-consent" className="bg-slate-900">No Consent</option>
            </select>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold text-slate-300">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm ? "No customers match your search criteria." : "Register regular shop customers to track orders & billing."}
            </p>
            {!searchTerm && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Email & Location</th>
                  <th className="py-3.5 px-4 text-center">WhatsApp Consent</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100">{c.name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sm text-blue-400">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {c.email && (
                        <div className="flex items-center gap-1 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.address ? (
                        <div className="flex items-center gap-1 text-slate-500 truncate max-w-[200px]">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{c.address}</span>
                        </div>
                      ) : (
                        !c.email && <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {c.whatsapp_consent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Consented
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <XCircle className="w-3 h-3" /> Opted Out
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenHistory(c)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-400 hover:text-white hover:bg-blue-600/20 transition"
                          title="View Invoices"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>History</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Customer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CustomerDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        customerToEdit={customerToEdit}
      />

      <CustomerHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        customer={historyCustomer}
      />
    </div>
  );
}

