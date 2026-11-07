"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-md transition"
    >
      <Printer className="w-4 h-4" />
      <span>Print / Save as PDF</span>
    </button>
  );
}

