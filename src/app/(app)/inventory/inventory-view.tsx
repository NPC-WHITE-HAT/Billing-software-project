"use client";

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/utils";
import RestockModal from "./restock-modal";
import { updateNegativeStockSetting } from "./actions";
import {
  Boxes,
  AlertTriangle,
  History,
  Search,
  PlusCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category_name?: string;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: string;
  quantity_delta: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  created_at: string;
  product_name?: string;
  product_sku?: string;
}

interface Props {
  products: InventoryProduct[];
  movements: InventoryMovement[];
  allowNegativeStock: boolean;
  userRole: string;
}

export default function InventoryView({
  products,
  movements,
  allowNegativeStock: initialAllowNeg,
  userRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<"levels" | "movements">("levels");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [isRestockOpen, setIsRestockOpen] = useState(false);

  const [allowNegStock, setAllowNegStock] = useState(initialAllowNeg);
  const [togglingPolicy, setTogglingPolicy] = useState(false);

  // Metrics
  const totalUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + Math.max(0, p.stock_quantity), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock_quantity <= 0).length;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      return (
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [products, searchTerm]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      return (
        !searchTerm.trim() ||
        (m.product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.product_sku || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.notes || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [movements, searchTerm]);

  async function handleToggleNegativeStock() {
    setTogglingPolicy(true);
    try {
      const nextVal = !allowNegStock;
      const res = await updateNegativeStockSetting(nextVal);
      if (res.success) {
        setAllowNegStock(nextVal);
      } else {
        alert(res.error || "Failed to update policy.");
      }
    } catch {
      alert("Error updating policy.");
    } finally {
      setTogglingPolicy(false);
    }
  }

  function handleOpenRestock(p: InventoryProduct) {
    setSelectedProduct(p);
    setIsRestockOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total In-Stock Units
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-white">
            {totalUnits}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Across {products.length} product SKUs
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Low Stock Alerts
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-amber-400">
            {lowStockCount}
          </div>
          <div className="mt-1 text-xs text-slate-400">Below safety threshold</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Out of Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-red-400">
            {outOfStockCount}
          </div>
          <div className="mt-1 text-xs text-slate-400">Immediate re-order required</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Negative Stock Policy
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`text-sm font-bold font-mono ${
                allowNegStock ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {allowNegStock ? "Allowed" : "Strictly Prevented"}
            </span>
            {(userRole === "owner" || userRole === "admin") && (
              <button
                disabled={togglingPolicy}
                onClick={handleToggleNegativeStock}
                className="text-[11px] underline text-slate-400 hover:text-white transition disabled:opacity-50"
              >
                {togglingPolicy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : allowNegStock ? (
                  "Enforce Prevention"
                ) : (
                  "Allow Negative"
                )}
              </button>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {allowNegStock
              ? "Cashier can bill when count is 0"
              : "Invoicing blocked if stock < quantity"}
          </div>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-1 border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab("levels")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "levels"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock Levels & Restock</span>
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "movements"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail & Movements ({movements.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === "levels"
                ? "Search product or SKU..."
                : "Filter movements by product or note..."
            }
            className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* TAB 1: Stock Levels */}
      {activeTab === "levels" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Current Stock</th>
                  <th className="py-3.5 px-4 text-center">Safety Threshold</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const isOut = p.stock_quantity <= 0;
                  const isLow = p.stock_quantity <= p.low_stock_threshold;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-blue-400">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {p.category_name || "General"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                        {p.stock_quantity}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400">
                        {p.low_stock_threshold}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            Out of stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            In stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenRestock(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 text-xs font-semibold border border-blue-500/20 transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Audit Trail & Movements */}
      {activeTab === "movements" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          {filteredMovements.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-300">No stock movements recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                Movements are automatically logged on every invoice sale and restock adjustment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Product & SKU</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-center">Change</th>
                    <th className="py-3.5 px-4 text-center">Previous &rarr; New</th>
                    <th className="py-3.5 px-4">Notes / Invoice Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMovements.map((m) => {
                    const isPositive = m.quantity_delta > 0;

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition text-xs">
                        <td className="py-3 px-4 text-slate-400">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">
                            {m.product_name || "Unknown Product"}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {m.product_sku || ""}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-800 text-slate-300">
                            {m.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={`inline-flex items-center gap-0.5 ${
                              isPositive ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            {isPositive ? `+${m.quantity_delta}` : m.quantity_delta}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {m.previous_stock} &rarr; <span className="font-bold text-white">{m.new_stock}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 truncate max-w-xs">
                          {m.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Restock Modal */}
      <RestockModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
}

