/**
 * create-beam-charge — Edge Function
 *
 * Input : POST  { order_id: string }
 * Output: { charge_id, qr_image, expires_at, amount }
 *
 * Beam API reference: https://docs.beamcheckout.com/charges/charges-api
 *   - amount is in satang (1 THB = 100 satang)
 *   - QR field: encodedImage.imageBase64Encoded
 *   - Charge ID: chargeId (not charge_id)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ── CORS headers (required for browser calls) ─────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function corsOk() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// ── Beam API helper ────────────────────────────────────────

const BEAM_BASE = "https://api.beamcheckout.com/api/v1";

function beamAuth(): string {
  const merchantId = Deno.env.get("BEAM_MERCHANT_ID");
  const apiKey = Deno.env.get("BEAM_API_KEY");
  if (!merchantId || !apiKey) throw new Error("BEAM_MERCHANT_ID or BEAM_API_KEY not set");
  return "Basic " + btoa(`${merchantId}:${apiKey}`);
}

async function beamGet(chargeId: string) {
  const res = await fetch(`${BEAM_BASE}/charges/${chargeId}`, {
    headers: { Authorization: beamAuth() },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Beam GET failed ${res.status}: ${body}`);
  }
  return res.json();
}

async function beamCreateCharge(amountSatang: number, orderId: string, expiryTime: string) {
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://bestpartbowls.com";

  const body = {
    amount: amountSatang,
    currency: "THB",
    paymentMethod: {
      paymentMethodType: "QR_PROMPT_PAY",
      qrPromptPay: {
        expiryTime, // ISO-8601 ~10 min from now
      },
    },
    referenceId: orderId,   // Beam field is referenceId (not reference)
    returnUrl: `${siteUrl}/track/${orderId}`,
  };

  const res = await fetch(`${BEAM_BASE}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: beamAuth(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Beam POST failed ${res.status}: ${errBody}`);
  }
  return res.json();
}

// ── Main handler ───────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsOk();
  if (req.method !== "POST") return err("Method not allowed", 405);

  try {
    // Parse input
    let orderId: string;
    try {
      const body = await req.json();
      orderId = body?.order_id;
    } catch {
      return err("Invalid JSON body");
    }
    if (!orderId || typeof orderId !== "string") {
      return err("order_id is required");
    }

    // Supabase service-role client (auto-injected creds)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch order
    const { data: order, error: dbErr } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, grand_total, beam_charge_id")
      .eq("id", orderId)
      .single();

    if (dbErr || !order) return err("Order not found", 404);

    // Guard: only process awaiting_payment orders
    if (order.status !== "awaiting_payment") {
      return err(`Order status is '${order.status}', expected 'awaiting_payment'`, 422);
    }
    if (order.payment_status === "paid") {
      return err("Order is already paid", 422);
    }

    // Convert grand_total (THB) → satang
    const amountSatang = Math.round(Number(order.grand_total) * 100);
    if (!Number.isFinite(amountSatang) || amountSatang <= 0) {
      return err("Invalid grand_total on order", 500);
    }

    // ── Idempotency check ──────────────────────────────────
    if (order.beam_charge_id) {
      try {
        const existing = await beamGet(order.beam_charge_id);
        if (existing.status === "PENDING" && existing.encodedImage?.imageBase64Encoded) {
          // Return existing QR — do NOT create a new charge
          return json({
            charge_id:  existing.chargeId,
            qr_image:   existing.encodedImage.imageBase64Encoded,
            expires_at: existing.encodedImage.expiry,
            amount:     amountSatang,
          });
        }
        // FAILED (includes expired QR) or SUCCEEDED without payment_status update yet:
        // fall through to create a new charge
      } catch (e) {
        console.error("Could not fetch existing charge, will create new:", e);
      }
    }

    // ── Create new Beam charge ─────────────────────────────
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const charge = await beamCreateCharge(amountSatang, orderId, expiryTime);

    if (
      charge.actionRequired !== "ENCODED_IMAGE" ||
      !charge.encodedImage?.imageBase64Encoded
    ) {
      console.error("Unexpected Beam response:", JSON.stringify(charge));
      return err("Beam did not return a QR image", 502);
    }

    // Store chargeId on the order
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ beam_charge_id: charge.chargeId })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to store beam_charge_id:", updateErr.message);
      // Non-fatal — still return QR to client
    }

    // Return QR data (never return API keys)
    return json({
      charge_id:  charge.chargeId,
      qr_image:   charge.encodedImage.imageBase64Encoded,
      expires_at: charge.encodedImage.expiry,
      amount:     amountSatang,
    });
  } catch (e) {
    console.error("Unhandled error in create-beam-charge:", e);
    return err("Internal server error", 500);
  }
});
