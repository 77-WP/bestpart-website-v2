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

  branchName:  'สาขาทองหล่อ ซอย 13',
} as const;

/** "21:00" */
export function shopCloseLabel(): string {
  return `${String(SHOP.closeHour).padStart(2, '0')}:${String(SHOP.closeMinute).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Time-slot generation (call once per Checkout mount)
// ---------------------------------------------------------------------------

export interface TimeSlot {
  label:  string;
  sub:    string;
  value:  string; // sent as pickup_time to DB: "โดยเร็วที่สุด" | "HH:MM"
  isAsap?: boolean;
}

export interface ShopInfo {
  isOpen:       boolean;
  slots:        TimeSlot[];
  nextOpenMsg:  string; // e.g. "วันจันทร์ 11:30"
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function openLabel(): string {
  return `${String(SHOP.openHour).padStart(2, '0')}:${String(SHOP.openMinute).padStart(2, '0')}`;
}

function nextOpenMsg(dow: number, nowMin: number): string {
  const openMin = SHOP.openHour * 60 + SHOP.openMinute;
  // Before open today (not a closed day)
  if (!SHOP.closedDays.includes(dow) && nowMin < openMin) {
    return `วันนี้ ${openLabel()}`;
  }
  // After close or closed day — find next open weekday
  let next = (dow + 1) % 7;
  while (SHOP.closedDays.includes(next)) next = (next + 1) % 7;
  return `วัน${THAI_DAYS[next]} ${openLabel()}`;
}

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

  // "พร้อมเร็วสุด"
  slots.push({
    label:  'พร้อมเร็วสุด',
    sub:    `~${SHOP.prepMinutes} นาที`,
    value:  'โดยเร็วที่สุด',
    isAsap: true,
  });

  // Regular 15-min slots from (now + prep, rounded up) to close
  const firstSlotMin = Math.ceil((nowMin + SHOP.prepMinutes) / 15) * 15;
  for (let m = firstSlotMin; m < closeMin; m += 15) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    const label = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const diff  = m - nowMin;
    slots.push({ label, sub: `ใน ${diff} นาที`, value: label });
  }

  return { isOpen: true, slots, nextOpenMsg: '' };
}
