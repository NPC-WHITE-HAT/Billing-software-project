"use client";

import Link from "next/link";
import { ReceiptText, ShieldCheck, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface TopbarProps {
  businessName: string;
  currency: string;
}

export default function Topbar({ businessName, currency }: TopbarProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(new Date())
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="truncate text-sm font-semibold text-slate-800">{businessName}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
            {currency}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {time && (
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-500 sm:flex">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{time} IST</span>
          </div>
        )}

        <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 md:flex">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Single-Shop Retail OS</span>
        </div>

        <Link
          href="/billing"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 sm:px-4"
        >
          <ReceiptText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Create Invoice (F2)</span>
          <span className="sm:hidden">Invoice</span>
        </Link>
      </div>
    </header>
  );
}
