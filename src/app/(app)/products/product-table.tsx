"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import ProductDialog, { CategoryOption, ProductItem } from "./product-dialog";
import { archiveProduct } from "./actions";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";

interface ProductRow extends ProductItem {
  category?: {
    id: string;
    name: string;
  } | null;
}

interface Props {
  initialProducts: ProductRow[];
  categories: CategoryOption[];
}

export default function ProductTable({ initialProducts, categories }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>(categories);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return initialProducts.filter((item) => {
      // Search
      const searchMatch =
        !searchTerm.trim() ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());

      // Category
      const catMatch =
        selectedCategory === "all" || item.category_id === selectedCategory;

      // Stock
      let stockMatch = true;
      if (stockFilter === "low") {
        stockMatch = item.stock_quantity <= item.low_stock_threshold;
      } else if (stockFilter === "out") {
        stockMatch = item.stock_quantity <= 0;
      }

      return searchMatch && catMatch && stockMatch;
    });
  }, [initialProducts, searchTerm, selectedCategory, stockFilter]);

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove "${name}" from active products?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await archiveProduct(id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  function handleOpenCreate() {
    setProductToEdit(null);
    setIsDialogOpen(true);
  }

  function handleOpenEdit(prod: ProductRow) {
    setProductToEdit({
      id: prod.id,
      name: prod.name,
      sku: prod.sku,
      category_id: prod.category_id,
      selling_price: prod.selling_price,
      purchase_price: prod.purchase_price,
      stock_quantity: prod.stock_quantity,
      low_stock_threshold: prod.low_stock_threshold,
    });
    setIsDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Filters & Add Product */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Stock</option>
              <option value="low" className="bg-slate-900">Low Stock Alert</option>
              <option value="out" className="bg-slate-900">Out of Stock</option>
            </select>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold text-slate-300">No products found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm ? "No products matching your search filter." : "Click Add Product to start building your catalog."}
            </p>
            {!searchTerm && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Product & Category</th>
                  <th className="py-3.5 px-4">SKU / Code</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Purchase Cost</th>
                  <th className="py-3.5 px-4 text-center">Stock Level</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const isLow = p.stock_quantity <= p.low_stock_threshold;
                  const isOut = p.stock_quantity <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100">{p.name}</div>
                        <div className="text-xs text-slate-400">
                          {p.category?.name || "Uncategorized"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-400">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-white">
                        {formatCurrency(p.selling_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                        {p.purchase_price ? formatCurrency(p.purchase_price) : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" /> Out of stock (0)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> Low Stock ({p.stock_quantity})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> {p.stock_quantity} in stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            disabled={deletingId === p.id}
                            onClick={() => handleArchive(p.id, p.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Archive Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        productToEdit={productToEdit}
        categories={categoriesList}
        onCategoryAdded={(newCat) => setCategoriesList((prev) => [...prev, newCat])}
      />
    </div>
  );
}

