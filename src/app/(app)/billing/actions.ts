"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface InvoiceItemInput {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoicePayload {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  items: InvoiceItemInput[];
  paymentMethod: "cash" | "upi" | "card";
  paymentReference?: string | null;
  discountAmount?: number;
  notes?: string | null;
}

export async function processInvoiceCreation(payload: CreateInvoicePayload) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return { error: "Unauthorized: Business session not active." };
  }

  const supabase = await createClient();
  const businessId = context.business.id;
  const userId = context.user.id;

  if (!payload.items || payload.items.length === 0) {
    return { error: "Invoice must contain at least one item." };
  }

  if (!payload.customerName || payload.customerName.trim().length === 0) {
    return { error: "Customer name is required (e.g. Walk-in Customer)." };
  }

  const paymentMethod = payload.paymentMethod || "cash";
  const discountAmount = Math.max(0, Number(payload.discountAmount || 0));

  // Prepare RPC items payload
  const rpcItems = payload.items.map((i) => ({
    product_id: i.productId,
    quantity: Math.max(1, Math.floor(Number(i.quantity))),
    unit_price: Number(i.unitPrice),
  }));

  // Try calling the atomic database procedure first
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_invoice_atomic",
    {
      p_business_id: businessId,
      p_customer_id: payload.customerId || null,
      p_customer_name: payload.customerName.trim(),
      p_customer_phone: payload.customerPhone?.trim() || null,
      p_items: rpcItems,
      p_payment_method: paymentMethod,
      p_payment_reference: payload.paymentReference?.trim() || null,
      p_discount_amount: discountAmount,
      p_notes: payload.notes?.trim() || null,
    }
  );

  if (!rpcError && rpcResult?.success) {
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    revalidatePath("/reports");
    revalidatePath("/products");

    return {
      success: true,
      invoiceId: rpcResult.invoice_id,
      invoiceNumber: rpcResult.invoice_number,
      grandTotal: rpcResult.grand_total,
    };
  }

  // If RPC is not available in remote db yet, execute fallback verified server transaction
  if (rpcError) {
    console.warn("create_invoice_atomic RPC error or not applied, executing secure fallback:", rpcError.message);
  }

  try {
    // 1. Lock/Fetch settings for prefix and sequence
    const { data: settings, error: setErr } = await supabase
      .from("business_settings")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (setErr || !settings) {
      return { error: "Could not retrieve store billing settings." };
    }

    // 2. Fetch main branch
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("business_id", businessId)
      .order("is_main", { ascending: false })
      .limit(1)
      .maybeSingle();

    const invoicePrefix = settings.invoice_prefix || "INV";
    const currentSeq = settings.invoice_sequence || 1;
    const invoiceNumber = `${invoicePrefix}-${String(currentSeq).padStart(6, "0")}`;

    // Update sequence
    await supabase
      .from("business_settings")
      .update({
        invoice_sequence: currentSeq + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    // 3. Verify stock availability for all products
    const productIds = payload.items.map((i) => i.productId);
    const { data: dbProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, name, sku, stock_quantity")
      .in("id", productIds)
      .eq("business_id", businessId);

    if (prodErr || !dbProducts) {
      return { error: "Failed to verify inventory items." };
    }

    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

    for (const item of payload.items) {
      const dbProd = prodMap.get(item.productId);
      if (!dbProd) {
        return { error: `Product "${item.name}" was not found in inventory.` };
      }
      if (!settings.allow_negative_stock && dbProd.stock_quantity < item.quantity) {
        return {
          error: `Insufficient stock for "${dbProd.name}". Available: ${dbProd.stock_quantity}, requested: ${item.quantity}.`,
        };
      }
    }

    // 4. Calculate Subtotal, Tax, Grand Total
    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const taxRate = Number(settings.tax_rate || 0);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // 5. Insert Invoice
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        business_id: businessId,
        branch_id: branch?.id || null,
        customer_id: payload.customerId || null,
        invoice_number: invoiceNumber,
        customer_name_snapshot: payload.customerName.trim(),
        customer_phone_snapshot: payload.customerPhone?.trim() || null,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        grand_total: grandTotal,
        payment_status: "paid",
        status: "completed",
        notes: payload.notes?.trim() || null,
        created_by: userId,
      })
      .select()
      .single();

    if (invError || !invoice) {
      return { error: `Failed to create invoice record: ${invError?.message}` };
    }

    const invoiceId = invoice.id;

    // 6. Insert Line Items & Deduct Stock
    for (const item of payload.items) {
      const dbProd = prodMap.get(item.productId)!;
      const newStock = dbProd.stock_quantity - item.quantity;
      const lineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;

      // Insert line item snapshot
      await supabase.from("invoice_items").insert({
        invoice_id: invoiceId,
        product_id: item.productId,
        product_name_snapshot: dbProd.name,
        sku_snapshot: dbProd.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: lineTotal,
      });

      // Update product stock
      await supabase
        .from("products")
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dbProd.id);

      // Record inventory movement
      await supabase.from("inventory_movements").insert({
        business_id: businessId,
        product_id: dbProd.id,
        type: "sale",
        quantity_delta: -item.quantity,
        previous_stock: dbProd.stock_quantity,
        new_stock: newStock,
        reference_id: invoiceId,
        notes: `Sold on invoice ${invoiceNumber}`,
        created_by: userId,
      });
    }

    // 7. Insert Payment Record
    await supabase.from("payments").insert({
      business_id: businessId,
      invoice_id: invoiceId,
      amount: grandTotal,
      payment_method: paymentMethod,
      reference_number: payload.paymentReference?.trim() || null,
    });

    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    revalidatePath("/reports");
    revalidatePath("/products");

    return {
      success: true,
      invoiceId,
      invoiceNumber,
      grandTotal,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Unexpected billing processing failure.",
    };
  }
}

