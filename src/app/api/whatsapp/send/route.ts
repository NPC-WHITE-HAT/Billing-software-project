import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  isWhatsAppConfigured,
  getWhatsAppConfig,
  uploadDocumentToMetaMedia,
  sendUtilityInvoiceTemplate,
} from "@/lib/whatsapp/client";
import { generateInvoicePdfBuffer } from "@/lib/whatsapp/pdf-generator";

export async function POST(request: NextRequest) {
  const context = await getCurrentBusinessContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { invoiceId } = body;

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const supabase = await createClient();
  const businessId = context.business.id;

  // 1. Fetch invoice, items, payments, and customer
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*), customer:customers(*), payments:payments(*)")
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // 2. Check customer WhatsApp consent
  const customer = Array.isArray(invoice.customer)
    ? invoice.customer[0]
    : invoice.customer;

  const recipientPhone =
    customer?.phone || invoice.customer_phone_snapshot;

  if (!recipientPhone) {
    return NextResponse.json(
      { error: "No contact phone number attached to this invoice." },
      { status: 400 }
    );
  }

  // Consent check: if customer record exists, check consent
  if (customer && !customer.whatsapp_consent) {
    return NextResponse.json(
      {
        error:
          "Customer has not provided WhatsApp messaging consent. Cannot deliver electronic bill.",
      },
      { status: 403 }
    );
  }

  const config = getWhatsAppConfig();
  const configured = isWhatsAppConfigured();

  // 3. Insert initial log record in whatsapp_message_logs (status: queued)
  const { data: logEntry, error: logError } = await supabase
    .from("whatsapp_message_logs")
    .insert({
      business_id: businessId,
      invoice_id: invoice.id,
      customer_id: customer?.id || null,
      recipient_phone: recipientPhone,
      template_name: config.templateName,
      status: "queued",
      retry_count: 0,
      last_attempt_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    console.warn("Could not insert whatsapp_message_log:", logError);
  }

  const logId = logEntry?.id;

  // If Meta API credentials are not yet configured on this server
  if (!configured) {
    const pendingMsg =
      "Meta WhatsApp Cloud API credentials are not yet configured on server. Message record created in queue.";

    if (logId) {
      await supabase
        .from("whatsapp_message_logs")
        .update({
          error_message: pendingMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return NextResponse.json({
      success: true,
      pendingConfig: true,
      message: pendingMsg,
      logId,
    });
  }

  // 4. Generate PDF buffer server-side
  const pdfBuffer = generateInvoicePdfBuffer({
    businessName: context.business.name,
    businessCategory: context.business.category,
    businessAddress: context.business.address,
    businessPhone: context.business.phone,
    gstin: context.business.gstin,
    invoiceNumber: invoice.invoice_number,
    createdAt: invoice.created_at,
    customerName: invoice.customer_name_snapshot,
    customerPhone: recipientPhone,
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discount_amount),
    taxAmount: Number(invoice.tax_amount),
    taxRate: Number(invoice.tax_rate),
    grandTotal: Number(invoice.grand_total),
    paymentMethod: invoice.payments?.[0]?.payment_method || "cash",
    paymentStatus: invoice.payment_status,
    items: (invoice.items || []).map((it: { product_name_snapshot: string; sku_snapshot: string; quantity: number; unit_price: number; total_price: number }) => ({
      productName: it.product_name_snapshot,
      sku: it.sku_snapshot,
      quantity: it.quantity,
      unitPrice: Number(it.unit_price),
      totalPrice: Number(it.total_price),
    })),
  });

  // 5. Upload PDF directly to Meta Media API
  const filename = `Invoice_${invoice.invoice_number}.pdf`;
  const uploadResult = await uploadDocumentToMetaMedia(pdfBuffer, filename);

  if (uploadResult.error || !uploadResult.mediaId) {
    if (logId) {
      await supabase
        .from("whatsapp_message_logs")
        .update({
          status: "failed",
          error_message: uploadResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return NextResponse.json(
      { error: `Media upload failed: ${uploadResult.error}` },
      { status: 502 }
    );
  }

  // 6. Send utility template document message
  const sendResult = await sendUtilityInvoiceTemplate({
    recipientPhone,
    mediaId: uploadResult.mediaId,
    documentFilename: filename,
    customerName: invoice.customer_name_snapshot,
    invoiceNumber: invoice.invoice_number,
    grandTotal: `INR ${Number(invoice.grand_total).toFixed(2)}`,
  });

  if (!sendResult.success) {
    if (logId) {
      await supabase
        .from("whatsapp_message_logs")
        .update({
          status: "failed",
          error_message: sendResult.error,
          retry_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return NextResponse.json(
      { error: sendResult.error || "Failed to dispatch WhatsApp message" },
      { status: 502 }
    );
  }

  // 7. Update log status to 'sent'
  if (logId) {
    await supabase
      .from("whatsapp_message_logs")
      .update({
        status: "sent",
        meta_message_id: sendResult.messageId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);
  }

  return NextResponse.json({
    success: true,
    messageId: sendResult.messageId,
    status: "sent",
  });
}

