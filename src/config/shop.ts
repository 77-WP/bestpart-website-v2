// Shop hours config — single source of truth for all time/hours UI

export const SHOP = {
  /** Opening time (Asia/Bangkok) */
  openHour:    11,
  openMinute:  30,

  /** Closing time — last order slot must be before this */
  closeHour:   21,
  closeMinute: 0,

  /** 0 = Sunday, 1 = Monday … 6 = Saturday */
  closedDays:  [0] as number[],

  /** Kitchen prep time used to offset the earliest pickup slot */
  prepMinutes: 12,

  branchName:   'สาขามีนบุรี ถนนสามวา',
  branchNameEn: 'Minburi Branch · Sam Wa Road',
} as const;

/** "21:00" */
export function shopCloseLabel(): string {
  return `${String(SHOP.closeHour).padStart(2, '0')}:${String(SHOP.closeMinute).padStart(2, '0')}`;
}

/** Round minutes up to the nearest multiple of 5 */
export function roundUp5(m: number): number { return Math.ceil(m / 5) * 5; }

/** Convert total minutes-of-day to "HH:MM" */
export function minToHHMM(m: number): string {
  const h   = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Time-slot generation
// ---------------------------------------------------------------------------

export interface TimeSlot {
  label:   string;        // "HH:MM" clock time — shown large in card
  diffMin: number;        // minutes from now (for "ใน ~X นาที" sub-line)
  value:   string | null; // null = ASAP (DB pickup_time = NULL), "HH:MM" for fixed
  isAsap?: boolean;
}

export interface ShopInfo {
  isOpen:      boolean;
  slots:       TimeSlot[];
  nextOpenMsg: string; // e.g. "วันจันทร์ 11:30"
}

export interface ShopStatus extends ShopInfo {
  previewOpen:  boolean;
  forcedClosed: boolean;
  reopenAt:     Date | null;
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function openLabel(): string {
  return `${String(SHOP.openHour).padStart(2, '0')}:${String(SHOP.openMinute).padStart(2, '0')}`;
}

function nextOpenMsgFromDow(dow: number, nowMin: number): string {
  const openMin = SHOP.openHour * 60 + SHOP.openMinute;
  if (!SHOP.closedDays.includes(dow) && nowMin < openMin) {
    return `วันนี้ ${openLabel()}`;
  }
  let next = (dow + 1) % 7;
  while (SHOP.closedDays.includes(next)) next = (next + 1) % 7;
  return `วัน${THAI_DAYS[next]} ${openLabel()}`;
}

/**
 * Compute up to 5 pickup time slots for the current Bangkok time:
 *   slot 0 — ASAP  : now + prepMinutes, rounded up to nearest 5 min, value = null
 *   slots 1–4      : now + 30 / 45 / 60 / 90 min, rounded up to 5 min
 * Slots past close time or duplicate times are skipped.
 */
export function computeSlots(): ShopInfo {
  const now    = new Date();
  const bkk    = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7
  const dow    = bkk.getUTCDay();
  const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();

  const openMin  = SHOP.openHour  * 60 + SHOP.openMinute;
  const closeMin = SHOP.closeHour * 60 + SHOP.closeMinute;

  const isOpen =
    !SHOP.closedDays.includes(dow) &&
    nowMin >= openMin &&
    nowMin < closeMin;

  if (!isOpen) {
    return { isOpen: false, slots: [], nextOpenMsg: nextOpenMsgFromDow(dow, nowMin) };
  }

  const slots: TimeSlot[] = [];
  const seen  = new Set<number>();

  // ASAP slot
  const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
  if (asapMin < closeMin) {
    seen.add(asapMin);
    slots.push({
      label:   minToHHMM(asapMin),
      diffMin: asapMin - nowMin,
      value:   null,
      isAsap:  true,
    });
  }

  // Fixed-offset slots: +30, +45, +60, +90 min, each rounded up to 5 min
  for (const offset of [30, 45, 60, 90]) {
    const slotMin = roundUp5(nowMin + offset);
    if (slotMin >= closeMin) continue;
    if (seen.has(slotMin)) continue;
    seen.add(slotMin);
    slots.push({
      label:   minToHHMM(slotMin),
      diffMin: slotMin - nowMin,
      value:   minToHHMM(slotMin),
    });
  }

  return { isOpen: true, slots, nextOpenMsg: '' };
}

/* ── getShopStatus: single source of truth for shop open/close ─────────── */
/** Pure function — pass now and relevant env vars; returns full ShopStatus.
 *  Priority (top wins):
 *  1. VITE_VERCEL_ENV === 'preview'  AND  VITE_PREVIEW_OPEN === 'true' → always open
 *  2. VITE_FORCE_CLOSED_UNTIL set and current Bangkok time before it  → forced closed
 *  3. Normal opening hours from SHOP config
 *
 *  Security: rule 1 ONLY fires when VITE_VERCEL_ENV is EXACTLY 'preview'.
 *  Production / missing env → never triggers.
 */
export function getShopStatus(
  now: Date,
  env: {
    VITE_VERCEL_ENV?:         string;
    VITE_PREVIEW_OPEN?:       string;
    VITE_FORCE_CLOSED_UNTIL?: string;
  },
): ShopStatus {
  /* ── Rule 1: preview-only open ──────────────────────────── */
  const isPreviewEnv = env.VITE_VERCEL_ENV === 'preview';
  const previewOpen  = isPreviewEnv && env.VITE_PREVIEW_OPEN === 'true';

  if (previewOpen) {
    const bkk    = new Date(now.getTime() + 7 * 3_600_000);
    const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
    const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
    return {
      isOpen:       true,
      slots:        [{ label: minToHHMM(asapMin), diffMin: SHOP.prepMinutes, value: null, isAsap: true }],
      nextOpenMsg:  '',
      previewOpen:  true,
      forcedClosed: false,
      reopenAt:     null,
    };
  }

  /* ── Rule 2: forced closed ──────────────────────────────── */
  if (env.VITE_FORCE_CLOSED_UNTIL) {
    const reopenAt = new Date(env.VITE_FORCE_CLOSED_UNTIL);
    if (!isNaN(reopenAt.getTime()) && now < reopenAt) {
      return {
        isOpen:       false,
        slots:        [],
        nextOpenMsg:  '',
        previewOpen:  false,
        forcedClosed: true,
        reopenAt,
      };
    }
  }

  /* ── Rule 3: normal hours ───────────────────────────────── */
  const bkk    = new Date(now.getTime() + 7 * 3_600_000);
  const dow    = bkk.getUTCDay();
  const nowMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();

  const openMin  = SHOP.openHour  * 60 + SHOP.openMinute;
  const closeMin = SHOP.closeHour * 60 + SHOP.closeMinute;

  const isOpen =
    !SHOP.closedDays.includes(dow) &&
    nowMin >= openMin &&
    nowMin < closeMin;

  if (!isOpen) {
    return {
      isOpen:       false,
      slots:        [],
      nextOpenMsg:  nextOpenMsgFromDow(dow, nowMin),
      previewOpen:  false,
      forcedClosed: false,
      reopenAt:     null,
    };
  }

  const slots: TimeSlot[] = [];
  const seen  = new Set<number>();

  const asapMin = roundUp5(nowMin + SHOP.prepMinutes);
  if (asapMin < closeMin) {
    seen.add(asapMin);
    slots.push({ label: minToHHMM(asapMin), diffMin: asapMin - nowMin, value: null, isAsap: true });
  }
  for (const offset of [30, 45, 60, 90]) {
    const slotMin = roundUp5(nowMin + offset);
    if (slotMin >= closeMin || seen.has(slotMin)) continue;
    seen.add(slotMin);
    slots.push({ label: minToHHMM(slotMin), diffMin: slotMin - nowMin, value: minToHHMM(slotMin) });
  }

  return { isOpen: true, slots, nextOpenMsg: '', previewOpen: false, forcedClosed: false, reopenAt: null };
}

/** Convenience wrapper — reads current time + Vite env vars. */
export function computeShopStatus(): ShopStatus {
  return getShopStatus(new Date(), {
    VITE_VERCEL_ENV:         import.meta.env.VITE_VERCEL_ENV,
    VITE_PREVIEW_OPEN:       import.meta.env.VITE_PREVIEW_OPEN,
    VITE_FORCE_CLOSED_UNTIL: import.meta.env.VITE_FORCE_CLOSED_UNTIL,
  });
}
