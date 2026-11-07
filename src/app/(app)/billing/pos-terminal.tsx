"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { processInvoiceCreation } from "./actions";
import InvoiceSuccessModal from "./invoice-success-modal";
import CustomerDialog, { CustomerItem } from "../customers/customer-dialog";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  AlertCircle,
  Loader2,
  UserPlus,
  User,
  Percent,
  Check,
  Package,
} from "lucide-react";

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  category_name?: string;
  selling_price: number;
  stock_quantity: number;
}

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  stockAvailable: number;
}

interface Props {
  initialProducts: PosProduct[];
  initialCustomers: CustomerItem[];
  taxRate: number;
  taxLabel: string;
  currency?: string;
  allowNegativeStock: boolean;
}

export default function PosTerminal({
  initialProducts,
  initialCustomers,
  taxRate,
  taxLabel,
  allowNegativeStock,
}: Props) {
  const [products] = useState<PosProduct[]>(initialProducts);
  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  const [notes, setNotes] = useState("");

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [walkinName, setWalkinName] = useState("Walk-in Customer");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [paymentReference, setPaymentReference] = useState("");

  // Submission & Dialog
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [completedInvoice, setCompletedInvoice] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    grandTotal: number;
    customerName: string;
    customerPhone: string | null;
    hasConsent: boolean;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Categories list
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.category_id && p.category_name) {
        map.set(p.category_id, p.category_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        selectedCategory === "all" || p.category_id === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Keyboard shortcut listener (F2 focuses search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cart operations
  function addToCart(product: PosProduct) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (!allowNegativeStock && existing.quantity >= product.stock_quantity) {
          alert(`Cannot add more than available stock (${product.stock_quantity}).`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (!allowNegativeStock && product.stock_quantity <= 0) {
        alert("This product is currently out of stock.");
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.selling_price,
          stockAvailable: product.stock_quantity,
        },
      ];
    });
  }

  function updateQuantity(productId: string, newQty: number) {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (!allowNegativeStock && newQty > item.stockAvailable) {
            alert(`Maximum available stock is ${item.stockAvailable}.`);
            return { ...item, quantity: item.stockAvailable };
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscountAmount("0");
    setNotes("");
    setPaymentReference("");
    setSubmissionError("");
  }

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const discount = Math.max(0, Math.min(subtotal, parseFloat(discountAmount) || 0));
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Checkout Handler
  async function handleCheckout() {
    if (cart.length === 0) {
      setSubmissionError("Cart is empty. Add products before checkout.");
      return;
    }

    setSubmissionError("");
    setIsSubmitting(true);

    const custName = selectedCustomer ? selectedCustomer.name : walkinName.trim() || "Walk-in Customer";
    const custPhone = selectedCustomer ? selectedCustomer.phone : walkinPhone.trim() || null;
    const hasConsent = selectedCustomer ? selectedCustomer.whatsapp_consent : false;

    try {
      const res = await processInvoiceCreation({
        customerId: selectedCustomer?.id || null,
        customerName: custName,
        customerPhone: custPhone,
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        paymentMethod,
        paymentReference: paymentReference.trim() || null,
        discountAmount: discount,
        notes: notes.trim() || null,
      });

      if (res.error) {
        setSubmissionError(res.error);
        setIsSubmitting(false);
        return;
      }

      // Success
      setCompletedInvoice({
        invoiceId: res.invoiceId!,
        invoiceNumber: res.invoiceNumber!,
        grandTotal: res.grandTotal!,
        customerName: custName,
        customerPhone: custPhone,
        hasConsent,
      });

      clearCart();
    } catch (err: unknown) {
      setSubmissionError(
        err instanceof Error ? err.message : "Failed to process transaction."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
      {/* LEFT COLUMN: Product Catalog (7 cols) */}
      <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        {/* Catalog Search & Category Tabs */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name or SKU / Barcode... (F2)"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-12 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              F2
            </span>
          </div>

          {/* Categories Tab Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition ${
                  selectedCategory === c.id
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
              <Package className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-300">No products matching</p>
              <p className="text-xs text-slate-400 mt-1">Try another search term or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id);
                const isOutOfStock = p.stock_quantity <= 0;

                return (
                  <button
                    key={p.id}
                    disabled={!allowNegativeStock && isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`text-left p-3.5 rounded-xl border transition flex flex-col justify-between relative group ${
                      inCart
                        ? "border-blue-500 bg-blue-950/20 shadow-md"
                        : "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70"
                    } ${!allowNegativeStock && isOutOfStock ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug">
                        {p.name}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        {p.sku}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {formatCurrency(p.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          isOutOfStock
                            ? "text-red-400"
                            : p.stock_quantity <= 5
                            ? "text-amber-400 font-bold"
                            : "text-slate-400"
                        }`}
                      >
                        {p.stock_quantity} left
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Bill / Cart / Checkout (5 cols) */}
      <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        {/* Customer Selector Bar */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Customer
            </span>
            <button
              onClick={() => setIsNewCustomerOpen(true)}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <UserPlus className="w-3 h-3" /> New Customer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            {!selectedCustomer ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Walk-in name"
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-mono text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>{selectedCustomer.phone}</span>
                {selectedCustomer.whatsapp_consent && (
                  <span className="text-[10px] text-emerald-300 ml-auto font-sans font-semibold">
                    WhatsApp Opt-in
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart Line Items Table */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-12">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30 text-blue-400" />
              <p className="text-sm font-semibold text-slate-300">Invoice Cart is Empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Click items on the left catalog or search by SKU/barcode to begin billing.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-semibold text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {item.sku} &bull; {formatCurrency(item.unitPrice)}
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, parseInt(e.target.value, 10) || 1)
                      }
                      className="w-10 text-center rounded bg-slate-900 border border-slate-700 py-0.5 text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="w-20 text-right font-mono font-bold text-xs text-white">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="ml-2 p-1 text-slate-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Calculations & Payment Summary */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 space-y-3">
          {submissionError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Subtotal, Discount & Tax breakdown */}
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span className="font-mono font-semibold text-white">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-400">
                <Percent className="w-3 h-3" /> Discount (₹)
              </span>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-right rounded-lg border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            {taxRate > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>{taxLabel} ({taxRate}%)</span>
                <span className="font-mono">{formatCurrency(taxAmount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Grand Total
              </span>
              <span className="text-2xl font-extrabold font-mono text-emerald-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
              Payment Method
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  paymentMethod === "cash"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <Banknote className="w-3.5 h-3.5" /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  paymentMethod === "upi"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> UPI / QR
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  paymentMethod === "card"
                    ? "border-purple-500 bg-purple-500/10 text-purple-400 shadow-sm"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Card
              </button>
            </div>

            {paymentMethod !== "cash" && (
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === "upi" ? "UPI UTR / Ref Number" : "Card Auth Code / Ref Number"}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            )}
          </div>

          {/* Checkout Action Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0 || isSubmitting}
              className="px-3 py-3 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-30"
              title="Clear Cart"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Invoice...</span>
                </>
              ) : (
                <span>Charge & Print Invoice ({formatCurrency(grandTotal)})</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Invoice Completed */}
      {completedInvoice && (
        <InvoiceSuccessModal
          isOpen={Boolean(completedInvoice)}
          onClose={() => setCompletedInvoice(null)}
          invoiceId={completedInvoice.invoiceId}
          invoiceNumber={completedInvoice.invoiceNumber}
          grandTotal={completedInvoice.grandTotal}
          customerName={completedInvoice.customerName}
          customerPhone={completedInvoice.customerPhone}
          hasWhatsappConsent={completedInvoice.hasConsent}
        />
      )}

      {/* Quick Customer Registration Modal */}
      <CustomerDialog
        isOpen={isNewCustomerOpen}
        onClose={() => setIsNewCustomerOpen(false)}
        onCreated={(newCust) => {
          setCustomers((prev) => [newCust, ...prev]);
          setSelectedCustomerId(newCust.id);
        }}
      />
    </div>
  );
}

