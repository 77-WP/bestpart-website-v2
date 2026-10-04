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

  branchName:  'สาขามีนบุรี ถนนสามวา',
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

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function openLabel(): string {
  return `${String(SHOP.openHour).padStart(2, '0')}:${String(SHOP.openMinute).padStart(2, '0')}`;
}

function nextOpenMsg(dow: number, nowMin: number): string {
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
    return { isOpen: false, slots: [], nextOpenMsg: nextOpenMsg(dow, nowMin) };
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
