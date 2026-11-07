import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getWhatsAppConfig, verifyMetaSignature } from "@/lib/whatsapp/client";

// Webhook Verification (GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const config = getWhatsAppConfig();

  if (!config.webhookVerifyToken) {
    return new Response("Webhook verification is not configured", { status: 503 });
  }

  if (mode === "subscribe" && token === config.webhookVerifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// Webhook Status Events (POST)
export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig();
  const rawBody = await request.text();

  if (!config.appSecret) {
    return new Response("Webhook signature verification is not configured", { status: 503 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, config.appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  interface WebhookPayload {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string;
            status: string;
            errors?: Array<{ title?: string; message?: string }>;
          }>;
        };
      }>;
    }>;
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Check for status events
  const entries = body.entry || [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Webhook database access is not configured", { status: 503 });
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const statuses = value.statuses || [];

      for (const statusObj of statuses) {
        const metaMessageId = statusObj.id;
        const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
        const errors = statusObj.errors;
        const errorDesc = errors && errors.length > 0 ? errors[0].title || errors[0].message : null;

        if (metaMessageId && ["sent", "delivered", "read", "failed"].includes(status)) {
          const { error } = await supabase
            .from("whatsapp_message_logs")
            .update({
              status,
              error_message: errorDesc,
              updated_at: new Date().toISOString(),
            })
            .eq("meta_message_id", metaMessageId);

          if (error) {
            console.error("Could not update WhatsApp message status.");
            return new Response("Webhook status update failed", { status: 500 });
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
