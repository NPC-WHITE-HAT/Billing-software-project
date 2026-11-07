"use client";

import { useState, type FormEvent } from "react";
import { createProduct, updateProduct, createCategory } from "./actions";
import { X, Loader2, AlertCircle, Plus } from "lucide-react";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: ProductItem | null;
  categories: CategoryOption[];
  onCategoryAdded?: (newCat: CategoryOption) => void;
}

function ProductFormInner({
  productToEdit,
  categories,
  onClose,
  onCategoryAdded,
}: {
  productToEdit?: ProductItem | null;
  categories: CategoryOption[];
  onClose: () => void;
  onCategoryAdded?: (newCat: CategoryOption) => void;
}) {
  const isEditing = Boolean(productToEdit);

  const [name, setName] = useState(productToEdit?.name || "");
  const [sku, setSku] = useState(productToEdit?.sku || "");
  const [categoryId, setCategoryId] = useState(
    productToEdit?.category_id || (categories.length > 0 ? categories[0].id : "")
  );
  const [sellingPrice, setSellingPrice] = useState(
    productToEdit ? String(productToEdit.selling_price) : ""
  );
  const [purchasePrice, setPurchasePrice] = useState(
    productToEdit ? String(productToEdit.purchase_price || 0) : ""
  );
  const [stockQuantity, setStockQuantity] = useState(
    productToEdit ? String(productToEdit.stock_quantity) : "10"
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    productToEdit ? String(productToEdit.low_stock_threshold) : "5"
  );

  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateCategorySubmit() {
    if (!newCatName.trim()) return;
    try {
      const res = await createCategory(newCatName.trim());
      if (res.error) {
        setError(res.error);
      } else if (res.category) {
        onCategoryAdded?.(res.category);
        setCategoryId(res.category.id);
        setIsCreatingCat(false);
        setNewCatName("");
      }
    } catch {
      setError("Failed to create category");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name,
        sku,
        categoryId: categoryId || null,
        sellingPrice: parseFloat(sellingPrice) || 0,
        purchasePrice: parseFloat(purchasePrice) || 0,
        stockQuantity: parseInt(stockQuantity, 10) || 0,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      };

      if (isEditing && productToEdit) {
        const res = await updateProduct(productToEdit.id, payload);
        if (res.error) {
          setError(res.error);
          setLoading(false);
          return;
        }
      } else {
        const res = await createProduct(payload);
        if (res.error) {
          setError(res.error);
          setLoading(false);
          return;
        }
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white">
          {isEditing ? "Edit Product" : "Add New Product"}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Slim Fit Cotton Formal Shirt"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              SKU / Barcode *
            </label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="e.g. SHT-BLK-M"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingCat(!isCreatingCat)}
                className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {isCreatingCat ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateCategorySubmit}
                  className="px-2.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingCat(false)}
                  className="px-2 py-1.5 text-xs text-slate-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Selling Price (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="799.00"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Purchase Cost (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="450.00"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Stock Quantity *
            </label>
            <input
              type="number"
              step="1"
              min="0"
              required
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="10"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
              Low Stock Alert Threshold
            </label>
            <input
              type="number"
              step="1"
              min="1"
              required
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              placeholder="5"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
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
            {isEditing ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProductDialog({
  isOpen,
  onClose,
  productToEdit,
  categories,
  onCategoryAdded,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <ProductFormInner
        key={productToEdit?.id || "new-product"}
        productToEdit={productToEdit}
        categories={categories}
        onClose={onClose}
        onCategoryAdded={onCategoryAdded}
      />
    </div>
  );
}
