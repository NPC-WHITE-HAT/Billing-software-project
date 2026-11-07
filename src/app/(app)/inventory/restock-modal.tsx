"use client";

import { useState, type FormEvent } from "react";
import { adjustStock } from "./actions";
import { X, Loader2, AlertCircle, Plus, Minus, ArrowRight } from "lucide-react";

interface ProductQuickItem {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductQuickItem | null;
}

export default function RestockModal({ isOpen, onClose, product }: Props) {
  const [mode, setMode] = useState<"restock" | "adjustment">("restock");
  const [quantity, setQuantity] = useState("10");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"add" | "subtract">("add");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !product) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;

    setError("");
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity.");
      return;
    }

    const delta = mode === "restock" || adjustmentDirection === "add" ? qty : -qty;

    setLoading(true);
    try {
      const res = await adjustStock({
        productId: product.id,
        quantityDelta: delta,
        type: mode === "restock" ? "restock" : "adjustment",
        notes: notes || undefined,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Stock update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Adjust Inventory</h2>
            <p className="text-xs text-slate-400 font-mono">
              {product.name} ({product.sku})
            </p>
          </div>
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

        <div className="my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400">Current In-Stock Quantity:</span>
          <span className="font-mono font-bold text-white text-base">
            {product.stock_quantity}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("restock")}
                className={`py-2 text-xs font-semibold rounded-xl border transition ${
                  mode === "restock"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-slate-800 bg-slate-800/40 text-slate-400"
                }`}
              >
                + Restock / New Batch
              </button>
              <button
                type="button"
                onClick={() => setMode("adjustment")}
                className={`py-2 text-xs font-semibold rounded-xl border transition ${
                  mode === "adjustment"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-slate-800 bg-slate-800/40 text-slate-400"
                }`}
              >
                Manual Audit / Damage
              </button>
            </div>
          </div>

          {mode === "adjustment" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection("add")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                    adjustmentDirection === "add"
                      ? "border-slate-600 bg-slate-800 text-white"
                      : "border-slate-800 text-slate-400"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add to Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentDirection("subtract")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                    adjustmentDirection === "subtract"
                      ? "border-slate-600 bg-slate-800 text-white"
                      : "border-slate-800 text-slate-400"
                  }`}
                >
                  <Minus className="w-3.5 h-3.5 text-red-400" /> Deduct (Damage/Lost)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Audit Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received from Supplier / Physical Count Discrepancy"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Update Stock <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

