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
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:h-[calc(100dvh-12rem)] xl:min-h-[36rem] xl:grid-cols-12">
      <a
        href="#pos-current-sale"
        className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-blue-700 bg-blue-700 px-4 py-3 text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 xl:hidden"
        aria-label={`View cart with ${cart.length} items, total ${formatCurrency(grandTotal)}`}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          <span className="truncate">Cart · {cart.length} items</span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {formatCurrency(grandTotal)} <span className="ml-1 font-medium">View</span>
        </span>
      </a>

      {/* LEFT COLUMN: Product Catalog (7 cols) */}
      <section aria-label="Product catalog" className="flex h-[min(62dvh,560px)] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7 xl:h-auto xl:min-h-0">
        {/* Catalog Search & Category Tabs */}
        <div className="space-y-4 border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name or SKU / Barcode... (F2)"
              aria-label="Search products by name, SKU, or barcode"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
            <span className="absolute right-3 top-3 rounded-md border border-slate-200 bg-white px-1.5 py-1 font-mono text-[10px] font-semibold text-slate-500">
              F2
            </span>
          </div>

          {/* Categories Tab Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-lg border px-3 py-2 font-medium transition-colors ${
                selectedCategory === "all"
                  ? "border-blue-600 bg-blue-600 font-semibold text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`shrink-0 rounded-lg border px-3 py-2 font-medium transition-colors ${
                  selectedCategory === c.id
                    ? "border-blue-600 bg-blue-600 font-semibold text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
              <Package className="mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No products matching</p>
              <p className="mt-1 text-xs text-slate-500">Try another search term or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id);
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 5;

                return (
                  <button
                    key={p.id}
                    disabled={!allowNegativeStock && isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`group relative flex min-h-32 flex-col justify-between rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      inCart
                        ? "border-blue-300 bg-blue-50 ring-1 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                    } ${!allowNegativeStock && isOutOfStock ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    {inCart && (
                      <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${inCart.quantity} in cart`}>
                        {inCart.quantity}
                      </span>
                    )}

                    <div className="pr-5">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                        {p.name}
                      </div>
                      <div className="mt-1.5 font-mono text-[10px] text-slate-500">
                        {p.sku}
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {formatCurrency(p.selling_price)}
                      </span>
                      <span className={`rounded-md px-1.5 py-1 text-[10px] font-semibold ${
                        isOutOfStock
                          ? "bg-red-50 text-red-700"
                          : isLowStock
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {isOutOfStock ? "Out of stock" : isLowStock ? `${p.stock_quantity} left` : `${p.stock_quantity} in stock`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT COLUMN: Active Bill / Cart / Checkout (5 cols) */}
      <section id="pos-current-sale" aria-label="Current sale" className="scroll-mt-4 flex h-[min(78dvh,720px)] min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4 xl:col-span-5 xl:h-full xl:min-h-0">
        {/* Customer Selector Bar */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <User className="h-3.5 w-3.5 text-blue-600" /> Customer
            </span>
            <button
              onClick={() => setIsNewCustomerOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 hover:text-blue-800"
            >
              <UserPlus className="h-3 w-3" /> New Customer
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="min-w-0">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                aria-label="Select customer"
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
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
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Walk-in name"
                  aria-label="Walk-in customer name"
                  className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
                <input
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  aria-label="Walk-in customer phone"
                  className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="break-words font-semibold">{selectedCustomer.name}</div>
                  <div className="mt-0.5 break-all font-mono">{selectedCustomer.phone}</div>
                </div>
                {selectedCustomer.whatsapp_consent && (
                  <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-1 text-[10px] font-semibold text-emerald-700">
                    WhatsApp Opt-in
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart Line Items Table */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-slate-500">
              <ShoppingCart className="mb-2 h-10 w-10 text-blue-300" />
              <p className="text-sm font-semibold text-slate-800">Invoice Cart is Empty</p>
              <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-500">
                Click items on the left catalog or search by SKU/barcode to begin billing.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words text-sm font-semibold text-slate-900">
                        {item.name}
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-slate-500">
                        {item.sku}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      aria-label={`Remove ${item.name} from cart`}
                      title="Remove item"
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        aria-label={`Decrease ${item.name} quantity`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.productId, parseInt(e.target.value, 10) || 1)
                        }
                        aria-label={`${item.name} quantity`}
                        className="h-8 w-12 rounded-lg border border-slate-200 bg-slate-50 text-center font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  {/* Line Total */}
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">
                      Unit {formatCurrency(item.unitPrice)}
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Calculations & Payment Summary */}
        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 p-2.5 sm:space-y-2.5 sm:p-3">
          {submissionError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* Subtotal, Discount & Tax breakdown */}
          <div className="space-y-1.5 text-xs text-slate-600 sm:space-y-2 sm:text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Percent className="h-3.5 w-3.5" /> Discount (₹)
              </span>
              <div className="w-28">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  aria-label="Discount amount"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {taxRate > 0 && (
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>{taxLabel} ({taxRate}%)</span>
                <span className="font-mono text-slate-800">{formatCurrency(taxAmount)}</span>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 sm:text-sm">
                Grand Total
              </span>
              <span className="text-lg font-extrabold tracking-tight text-slate-950 tabular-nums sm:text-xl">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Payment Method
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                aria-pressed={paymentMethod === "cash"}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  paymentMethod === "cash"
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Banknote className="h-3.5 w-3.5 shrink-0" /> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                aria-pressed={paymentMethod === "upi"}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  paymentMethod === "upi"
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <QrCode className="h-3.5 w-3.5 shrink-0" /> UPI / QR
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                aria-pressed={paymentMethod === "card"}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  paymentMethod === "card"
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5 shrink-0" /> Card
              </button>
            </div>

            {paymentMethod !== "cash" && (
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === "upi" ? "UPI UTR / Ref Number" : "Card Auth Code / Ref Number"}
                aria-label={paymentMethod === "upi" ? "UPI reference number" : "Card reference number"}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              />
            )}
          </div>

          {/* Checkout Action Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0 || isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Clear Cart"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Invoice...</span>
                </>
              ) : (
                <span>Complete Sale · {formatCurrency(grandTotal)}</span>
              )}
            </button>
          </div>
        </div>
      </section>

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
