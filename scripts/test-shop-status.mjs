#!/usr/bin/env node
/**
 * test-shop-status.mjs — verify getShopStatus pure logic for 5 cases.
 * Plain JS reimplementation of the pure function (no Vite env, no imports).
 */

// ── Inline shop config ─────────────────────────────────────
const SHOP = {
  openHour: 11, openMinute: 30,
  closeHour: 21, closeMinute: 0,
  closedDays: [0],
  prepMinutes: 12,
};

function roundUp5(m) { return Math.ceil(m / 5) * 5; }
function minToHHMM(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
function openLabel() {
  return `${String(SHOP.openHour).padStart(2,'0')}:${String(SHOP.openMinute).padStart(2,'0')}`;
}
function nextOpenMsgFromDow(dow, nowMin) {
  const openMin = SHOP.openHour * 60 + SHOP.openMinute;
  if (!SHOP.closedDays.includes(dow) && nowMin < openMin) return `วันนี้ ${openLabel()}`;
  let next = (dow + 1) % 7;
  while (SHOP.closedDays.includes(next)) next = (next + 1) % 7;
  return `วัน${THAI_DAYS[next]} ${openLabel()}`;
}

function getShopStatus(now, env) {
  // Rule 1: preview open
  const isPreviewEnv = env.VITE_VERCEL_ENV === 'preview';
  const previewOpen  = isPreviewEnv && env.VITE_PREVIEW_OPEN === 'true';
  if (previewOpen) {
    const bkk = new Date(now.getTime() + 7 * 3_600_000);
    const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
    const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
    return {
      isOpen: true,
      slots: [{ label: minToHHMM(asapMin), diffMin: SHOP.prepMinutes, value: null, isAsap: true }],
      nextOpenMsg: '', previewOpen: true, forcedClosed: false, reopenAt: null,
    };
  }
  // Rule 2: forced closed
  if (env.VITE_FORCE_CLOSED_UNTIL) {
    const reopenAt = new Date(env.VITE_FORCE_CLOSED_UNTIL);
    if (!isNaN(reopenAt.getTime()) && now < reopenAt) {
      return { isOpen: false, slots: [], nextOpenMsg: '', previewOpen: false, forcedClosed: true, reopenAt };
    }
  }
  // Rule 3: normal hours
  const bkk = new Date(now.getTime() + 7 * 3_600_000);
  const dow = bkk.getUTCDay();
  const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  const openMin  = SHOP.openHour  * 60 + SHOP.openMinute;
  const closeMin = SHOP.closeHour * 60 + SHOP.closeMinute;
  const isOpen = !SHOP.closedDays.includes(dow) && nowMin >= openMin && nowMin < closeMin;
  if (!isOpen) {
    return { isOpen: false, slots: [], nextOpenMsg: nextOpenMsgFromDow(dow, nowMin),
      previewOpen: false, forcedClosed: false, reopenAt: null };
  }
  const slots = [], seen = new Set();
  const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
  if (asapMin < closeMin) {
    seen.add(asapMin);
    slots.push({ label: minToHHMM(asapMin), diffMin: asapMin - nowMin, value: null, isAsap: true });
  }
  for (const offset of [30, 45, 60, 90]) {
    const s = roundUp5(nowMin + offset);
    if (s >= closeMin || seen.has(s)) continue;
    seen.add(s);
    slots.push({ label: minToHHMM(s), diffMin: s - nowMin, value: minToHHMM(s) });
  }
  return { isOpen: true, slots, nextOpenMsg: '', previewOpen: false, forcedClosed: false, reopenAt: null };
}

// ── Test cases ─────────────────────────────────────────────
// Fixed Bangkok Tuesday 13:00 = UTC 06:00 (shop open)
const openTime      = new Date('2026-10-06T06:00:00Z'); // Bangkok 13:00 Tue
const futureISO     = '2026-10-07T06:00:00+07:00';      // Bangkok tomorrow 06:00
const sundayMidnight = new Date('2026-10-04T17:00:00Z'); // Bangkok Sun 00:00 (closed)

let pass = 0, fail = 0;
function check(name, result, expect) {
  const ok = Object.entries(expect).every(([k, v]) => {
    if (v === null) return result[k] === null;
    return result[k] === v;
  });
  if (ok) { console.log(`✅ ${name}`); pass++; }
  else    { console.error(`❌ ${name}`); console.error('  got:', JSON.stringify(result, null, 2)); console.error('  expected:', expect); fail++; }
}

// 1. Production normal (shop open Tuesday 13:00)
check('Production normal (open)',
  getShopStatus(openTime, { VITE_VERCEL_ENV: 'production' }),
  { isOpen: true, previewOpen: false, forcedClosed: false, reopenAt: null });

// 2. Production + FORCE_CLOSED future → forced closed
check('Production + FORCE_CLOSED_UNTIL (future) → closed',
  getShopStatus(openTime, { VITE_VERCEL_ENV: 'production', VITE_FORCE_CLOSED_UNTIL: futureISO }),
  { isOpen: false, forcedClosed: true, previewOpen: false });

// 3. Production + PREVIEW_OPEN=true → must NOT force open
check('Production + PREVIEW_OPEN=true → must NOT open',
  getShopStatus(openTime, { VITE_VERCEL_ENV: 'production', VITE_PREVIEW_OPEN: 'true' }),
  { previewOpen: false, isOpen: true }); // still open from normal hours, but NOT because of preview

// 4. Preview + PREVIEW_OPEN=true on Sunday midnight (normally closed) → forced open
check('Preview + PREVIEW_OPEN=true (Sunday midnight) → forced open',
  getShopStatus(sundayMidnight, { VITE_VERCEL_ENV: 'preview', VITE_PREVIEW_OPEN: 'true' }),
  { isOpen: true, previewOpen: true, forcedClosed: false });

// 5. Preview env, no PREVIEW_OPEN → normal hours (Sunday midnight = closed)
check('Preview env, no PREVIEW_OPEN → normal hours (closed)',
  getShopStatus(sundayMidnight, { VITE_VERCEL_ENV: 'preview' }),
  { isOpen: false, previewOpen: false, forcedClosed: false });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
