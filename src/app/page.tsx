import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentBusinessContext } from "@/lib/auth";
import Link from "next/link";
import { Store, ArrowRight, Zap, FileSpreadsheet, MessageSquare } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const biz = await getCurrentBusinessContext();
    if (biz) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Qelanto Business OS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-300 hover:text-white transition px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition"
          >
            Register Store
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 max-w-5xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-6">
          <Zap className="w-3.5 h-3.5" /> Single-Shop Retail Billing MVP
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight">
          Intelligent POS & Invoicing for Modern Retail
        </h1>
        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          Streamline counter billing, automate live stock deductions, maintain immutable tax invoices, and delight customers with instant WhatsApp receipts.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition w-full sm:w-auto justify-center"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition w-full sm:w-auto justify-center"
          >
            Open Shop Terminal
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base mb-1">High-Speed POS</h3>
            <p className="text-sm text-slate-400">
              Instant keyboard and barcode product search, flexible line discounts, GST calculations, and split payments.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base mb-1">Atomic Inventory Auditing</h3>
            <p className="text-sm text-slate-400">
              Real-time stock deduction with negative stock guardrails, threshold alerts, and tamper-proof ledger trails.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base mb-1">WhatsApp Cloud Billing</h3>
            <p className="text-sm text-slate-400">
              Official Meta Cloud API integration for server-rendered PDF dispatch directly to verified customer WhatsApp.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Qelanto Business OS. All rights reserved. Built for single-shop retail excellence.
      </footer>
    </main>
  );
}
