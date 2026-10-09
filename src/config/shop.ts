// Shop config — branch info and utility helpers
// Opening/closing hours are now sourced from bp_public_menu_state() server response only.

export const SHOP = {
  /** Kitchen prep time — used as fallback when server data hasn't arrived */
  prepMinutes: 12,

  branchName:   'สาขามีนบุรี ถนนสามวา',
  branchNameEn: 'Minburi Branch · Sam Wa Road',
} as const;

/** Round minutes up to the nearest multiple of 5 */
export function roundUp5(m: number): number { return Math.ceil(m / 5) * 5; }

/** Convert total minutes-of-day to "HH:MM" */
export function minToHHMM(m: number): string {
  const h   = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Types
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
  nextOpenMsg: string; // e.g. "วันนี้ 11:30"
}

// ---------------------------------------------------------------------------
// Date-format helpers (Bangkok timezone, Thai locale)
// ---------------------------------------------------------------------------

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/** Format an ISO timestamp as Bangkok "HH:MM" */
export function bkkHHMM(isoStr: string): string {
  const ms  = new Date(isoStr).getTime();
  const bkk = new Date(ms + 7 * 3_600_000);
  return `${String(bkk.getUTCHours()).padStart(2,'0')}:${String(bkk.getUTCMinutes()).padStart(2,'0')}`;
}

/**
 * Build a human-readable Thai "next open" string from an ISO timestamp.
 * Uses server time (serverNowMs) to determine today/tomorrow/date.
 * Examples: "วันนี้ 11:30", "พรุ่งนี้ 11:30", "31 ธ.ค. 11:30"
 */
export function nextOpenMsg(isoStr: string, serverNowMs: number): string {
  const BKK         = 7 * 3_600_000;
  const opensMs     = new Date(isoStr).getTime();
  const todayStr    = new Date(serverNowMs + BKK).toISOString().slice(0, 10);
  const tomorrowStr = new Date(serverNowMs + BKK + 24 * 3_600_000).toISOString().slice(0, 10);
  const opensStr    = new Date(opensMs + BKK).toISOString().slice(0, 10);
  const timeStr     = bkkHHMM(isoStr);

  if (opensStr === todayStr)    return `วันนี้ ${timeStr}`;
  if (opensStr === tomorrowStr) return `พรุ่งนี้ ${timeStr}`;

  const d = new Date(opensMs + BKK);
  return `${d.getUTCDate()} ${MONTHS_TH[d.getUTCMonth()]} ${timeStr}`;
}

// ---------------------------------------------------------------------------

export interface ShopStatus extends ShopInfo {
  previewOpen:  boolean;
  forcedClosed: boolean;
  reopenAt:     Date | null;
}
