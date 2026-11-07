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
          second: "2-digit",
          hour12: true,
        }).format(new Date())
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-200">{businessName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {currency}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {time && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{time} IST</span>
          </div>
        )}

        <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Single-Shop Retail OS</span>
        </div>

        <Link
          href="/billing"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
        >
          <ReceiptText className="w-3.5 h-3.5" />
          <span>Create Invoice (F2)</span>
        </Link>
      </div>
    </header>
  );
}

