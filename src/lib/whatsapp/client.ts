import crypto from "crypto";

export interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  templateName: string;
  webhookVerifyToken?: string;
  appSecret?: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "invoice_notification",
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  };
}

export function isWhatsAppConfigured(): boolean {
  const config = getWhatsAppConfig();
  return Boolean(config.phoneNumberId && config.accessToken);
}

export function sanitizePhoneNumber(phone: string): string {
  // Strip non-digit characters
  let clean = phone.replace(/\D/g, "");
  // Default to India country code 91 if 10-digit number
  if (clean.length === 10) {
    clean = `91${clean}`;
  }
  return clean;
}

export async function uploadDocumentToMetaMedia(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string = "application/pdf"
): Promise<{ mediaId?: string; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return { error: "Meta WhatsApp credentials not configured on server." };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append("file", blob, filename);
    formData.append("type", mimeType);
    formData.append("messaging_product", "whatsapp");

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { error: `Meta Media Upload Failed: ${res.status} ${errText}` };
    }

    const json = await res.json();
    return { mediaId: json.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Media upload error" };
  }
}

export async function sendUtilityInvoiceTemplate(params: {
  recipientPhone: string;
  mediaId?: string;
  documentFilename: string;
  customerName: string;
  invoiceNumber: string;
  grandTotal: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return {
      success: false,
      error: "WhatsApp Cloud API credentials are not yet configured on this server.",
    };
  }

  const cleanPhone = sanitizePhoneNumber(params.recipientPhone);

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "template",
    template: {
      name: config.templateName,
      language: {
        code: "en",
      },
      components: [
        params.mediaId
          ? {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    id: params.mediaId,
                    filename: params.documentFilename,
                  },
                },
              ],
            }
          : null,
        {
          type: "body",
          parameters: [
            { type: "text", text: params.customerName },
            { type: "text", text: params.invoiceNumber },
            { type: "text", text: params.grandTotal },
          ],
        },
      ].filter(Boolean),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Meta API Send Failed: ${res.status} ${errText}` };
    }

    const json = await res.json();
    const msgId = json.messages?.[0]?.id;
    return { success: true, messageId: msgId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Message dispatch failed",
    };
  }
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  if (!/^[0-9a-f]{64}$/i.test(parts[1])) return false;

  return crypto.timingSafeEqual(
    Buffer.from(parts[1], "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
