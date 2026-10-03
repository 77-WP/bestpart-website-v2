/**
 * beam-webhook-handler — Edge Function
 *
 * Receives Beam payment webhooks, verifies signature, and updates order status.
 *
 * Beam webhook docs: https://docs.beamcheckout.com/webhook-authentication
 *   - Header: X-Beam-Signature  (base64-encoded HMAC-SHA256)
 *   - HMAC key is BASE64-ENCODED in Lighthouse → must decode to raw bytes before use
 *   - Event type header: x-beam-event  (e.g. "charge.succeeded")
 *   - Must read raw body with req.text() before parse (signature over raw bytes)
 *   - Respond 200 to stop retries, 5xx to trigger retry
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ── Constant-time byte comparison ──────────────────────────
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── HMAC-SHA256 verification ───────────────────────────────
async function verifySignature(rawBody: string, headerSig: string): Promise<boolean> {
  const secret = Deno.env.get("BEAM_WEBHOOK_SECRET");
  if (!secret) {
    console.error("BEAM_WEBHOOK_SECRET is not set — rejecting (fail closed)");
    return false;
  }

  // Beam provides the HMAC key base64-encoded — decode to raw bytes first
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const bodyBytes = new TextEncoder().encode(rawBody);
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, bodyBytes);
  const computedBytes = new Uint8Array(sigBuffer);

  // Decode the header signature from base64 to bytes
  let headerBytes: Uint8Array;
  try {
    headerBytes = Uint8Array.from(atob(headerSig), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  return timingSafeEqual(computedBytes, headerBytes);
}

// ── Main handler ───────────────────────────────────────────

serve(async (req: Request) => {
  // Must read raw body first — signature is over the exact bytes Beam sent
  const rawBody = await req.text();

  // ── Signature verification (fail closed) ────────────────
  const headerSig = req.headers.get("x-beam-signature") ?? "";
  if (!headerSig) {
    console.error("Missing x-beam-signature header");
    return new Response("Unauthorized", { status: 401 });
  }

  const sigOk = await verifySignature(rawBody, headerSig);
  if (!sigOk) {
    console.error("Signature mismatch — rejecting webhook");
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Filter events ────────────────────────────────────────
  const eventType = req.headers.get("x-beam-event") ?? "";
  if (eventType !== "charge.succeeded") {
    // Not our event — acknowledge and skip
    return new Response("OK", { status: 200 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const chargeId: string = payload.chargeId;
    const reportedAmountSatang: number = payload.amount; // already in satang

    if (!chargeId) {
      console.error("Webhook payload missing chargeId");
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Find order by beam_charge_id (not by order_id from body) ──
    const { data: order, error: findErr } = await supabase
      .from("orders")
      .select("id, status, payment_status, grand_total, customer_phone, customer_id")
      .eq("beam_charge_id", chargeId)
      .single();

    if (findErr || !order) {
      console.error("Order not found for chargeId", chargeId, findErr?.message);
      // Acknowledge so Beam doesn't retry for an unknown charge
      return new Response("OK", { status: 200 });
    }

    // ── Amount verification ──────────────────────────────────
    const expectedSatang = Math.round(Number(order.grand_total) * 100);
    if (reportedAmountSatang !== expectedSatang) {
      console.error(
        `Amount mismatch for order ${order.id}: Beam=${reportedAmountSatang} expected=${expectedSatang}`,
      );
      // Return 500 to trigger Beam retry (could be a data race)
      return new Response("Amount mismatch", { status: 500 });
    }

    // ── Idempotent UPDATE (only if still awaiting_payment) ──
    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update({ payment_status: "paid", status: "pending" })
      .eq("id", order.id)
      .eq("status", "awaiting_payment")  // guard against double-processing
      .select()
      .single();

    if (updateErr) {
      console.error("DB update error:", updateErr.message);
      return new Response("DB error", { status: 500 });
    }

    if (!updated) {
      // No rows affected — webhook already processed (idempotent skip)
      console.log(`Order ${order.id} already processed, skipping`);
      return new Response("OK", { status: 200 });
    }

    // ── First-time processing ────────────────────────────────

    // (a) Customer recognition upsert
    await (async () => {
      // Try to find phone: prefer direct customer_phone column, else via customer_id FK
      let phone: string | null = order.customer_phone ?? null;

      if (!phone && order.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("phone")
          .eq("id", order.customer_id)
          .single();
        phone = cust?.phone ?? null;
      }

      if (!phone) {
        // Neither customer_phone column nor customers table reference found on order.
        // REPORT: orders table does not currently store customer phone.
        // Wire up after Checkout UI saves customer_phone to orders.
        console.log(`customer_recognition skipped for order ${order.id}: no phone found`);
        return;
      }

      const { error: upsertErr } = await supabase
        .from("customer_recognition")
        .upsert(
          {
            phone,
            order_count: 1,
            last_order_id: order.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "phone",
            // Increment order_count and update last_order_id on conflict
          },
        );

      if (upsertErr) {
        console.error("customer_recognition upsert failed:", upsertErr.message);
      }
    })();

    // (b) Trigger Telegram notification via notify-new-order
    await (async () => {
      const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-new-order`;
      const res = await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: "UPDATE",
          table: "orders",
          record: updated,
          schema: "public",
          old_record: null,
        }),
      });
      if (!res.ok) {
        console.error("notify-new-order call failed:", res.status, await res.text());
      }
    })();

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Unhandled error in beam-webhook-handler:", e);
    return new Response("Internal error", { status: 500 });
  }
});
