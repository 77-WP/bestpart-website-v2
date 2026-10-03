import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface OrderItem {
  name_en?: string;
  name?: string;
  qty?: number;
  quantity?: number;
}

interface OrderRecord {
  id: string;
  order_number: number;
  fulfillment_type: string;
  payment_method: string | null;
  checkout_payment_method?: string | null;
  payment_status?: string | null;
  items: OrderItem[] | null;
  grand_total: number;
  created_at: string;
  internal_notes: string | null;
  car_details: string | null;
  pickup_time: string | null;
  status: string;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: OrderRecord;
  schema: string;
  old_record: OrderRecord | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatBangkokTime(isoString: string): string {
  const date = new Date(isoString);
  const bangkokDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const day = String(bangkokDate.getUTCDate()).padStart(2, "0");
  const month = String(bangkokDate.getUTCMonth() + 1).padStart(2, "0");
  const year = bangkokDate.getUTCFullYear();
  const hours = String(bangkokDate.getUTCHours()).padStart(2, "0");
  const minutes = String(bangkokDate.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function parseCarDetails(order: OrderRecord): string | null {
  if (order.car_details?.trim()) return order.car_details.trim();
  if (order.internal_notes) {
    const match = order.internal_notes.match(/รถ:\s*(.+)/);
    if (match) return match[1].trim();
  }
  return null;
}

function paymentLabel(order: OrderRecord): string {
  const method = (order.checkout_payment_method ?? order.payment_method ?? "").trim();
  if (method.toLowerCase().includes("cash") || method.includes("เงินสด")) {
    return "เงินสด (จ่ายที่ร้าน)";
  }
  if (order.payment_status === "paid") return `จ่ายแล้ว (${method || "Beam"})`;
  return method || "ยังไม่ระบุ";
}

function formatMessage(order: OrderRecord): string {
  const time = formatBangkokTime(order.created_at);
  const pickupTime = order.pickup_time?.trim() || "โดยเร็วที่สุด";

  let itemLines = "";
  if (order.items && order.items.length > 0) {
    itemLines = order.items
      .map((item) => {
        const name = item.name_en || item.name || "(ไม่ระบุชื่อ)";
        const qty = Number(item.qty ?? item.quantity ?? 1);
        return `  • ${esc(name)} x${qty}`;
      })
      .join("\n");
  } else {
    itemLines = "  • (ไม่มีรายการ)";
  }

  const lines: string[] = [
    "🔔 ออเดอร์ใหม่!",
    "",
    `📋 Order #${order.order_number}`,
    `🛍️ ประเภท: ${esc(order.fulfillment_type ?? "")}`,
  ];

  const carDetails = parseCarDetails(order);
  if (carDetails) lines.push(`🚗 รถ: ${esc(carDetails)}`);

  lines.push(`🛒 รายการ:`, itemLines);
  lines.push(`💰 รวม: ฿${Number(order.grand_total).toFixed(2)}`);

  const notes = order.internal_notes || "";
  if (notes.includes("ช้อนส้อม: รับ")) lines.push("🥄 ช้อนส้อม");
  if (notes.includes("พริกน้ำปลา: รับ")) lines.push("🌶 พริกน้ำปลา");

  lines.push(`💳 ชำระ: ${esc(paymentLabel(order))}`);
  lines.push(`🕐 เวลารับ: ${esc(pickupTime)}`);
  lines.push(`🕐 สั่งเมื่อ: ${time}`);

  return lines.join("\n");
}

serve(async (req: Request) => {
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return new Response("OK", { status: 200 });
    }

    const payload: WebhookPayload = await req.json();
    const order = payload.record;

    if (!order || !order.id) {
      console.error("Invalid webhook payload — no record found");
      return new Response("OK", { status: 200 });
    }

    // GATE: ออเดอร์ที่ยังไม่จ่าย (Beam) ห้ามเด้งเข้าครัว
    if (order.status === "awaiting_payment") {
      console.log(`Skip order #${order.order_number}: awaiting_payment`);
      return new Response("OK", { status: 200 });
    }

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatMessage(order),
          parse_mode: "HTML",
        }),
      }
    );

    if (!telegramRes.ok) {
      const errBody = await telegramRes.text();
      console.error(`Telegram API error ${telegramRes.status}: ${errBody}`);
    } else {
      console.log(`Notification sent for order #${order.order_number}`);
    }
  } catch (err) {
    console.error("Unhandled error in notify-new-order:", err);
  }

  return new Response("OK", { status: 200 });
});
