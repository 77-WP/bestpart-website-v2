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
 * Build a human-readable "next open" string from a Date object.
 * Respects lang: Thai uses short Thai month names; EN uses Intl (en-GB).
 * Uses serverNowMs (corrected server time) to determine today/tomorrow.
 * Examples TH: "วันนี้ 11:30", "พรุ่งนี้ 11:30", "31 ธ.ค. 11:30"
 * Examples EN: "today 11:30", "tomorrow 11:30", "31 Dec 11:30"
 */
export function formatNextOpenForLang(at: Date, serverNowMs: number, lang: string): string {
  const BKK         = 7 * 3_600_000;
  const opensMs     = at.getTime();
  const todayStr    = new Date(serverNowMs + BKK).toISOString().slice(0, 10);
  const tomorrowStr = new Date(serverNowMs + BKK + 24 * 3_600_000).toISOString().slice(0, 10);
  const opensStr    = new Date(opensMs + BKK).toISOString().slice(0, 10);
  const timeStr     = bkkHHMM(at.toISOString());

  if (opensStr === todayStr)    return lang === 'th' ? `วันนี้ ${timeStr}`    : `today ${timeStr}`;
  if (opensStr === tomorrowStr) return lang === 'th' ? `พรุ่งนี้ ${timeStr}` : `tomorrow ${timeStr}`;

  if (lang === 'th') {
    const d = new Date(opensMs + BKK);
    return `${d.getUTCDate()} ${MONTHS_TH[d.getUTCMonth()]} ${timeStr}`;
  }
  // EN: locale-aware short date via Intl (Asia/Bangkok)
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok',
  }).format(at);
  return `${datePart} ${timeStr}`;
}

/** Thai-only variant used internally when lang is not available (server-side computation). */
export function nextOpenMsg(isoStr: string, serverNowMs: number): string {
  return formatNextOpenForLang(new Date(isoStr), serverNowMs, 'th');
}

// ---------------------------------------------------------------------------

export interface ShopStatus extends ShopInfo {
  previewOpen:  boolean;
  forcedClosed: boolean;
  reopenAt:     Date | null;
}
