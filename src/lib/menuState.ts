import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { roundUp5, minToHHMM, nextOpenMsg, SHOP, type ShopStatus, type TimeSlot } from '../config/shop';

export { formatNextOpenForLang } from '../config/shop';

/* ── Types ───────────────────────────────────────────────── */
type ItemState = {
  id: string;
  status: 'unavailable' | 'limited';
  restore_at: string | null;
  limited_qty?: number;
};

type OptionState = {
  id: string;
  restore_at: string | null;
};

type ShopData = {
  status: 'open' | 'preorder' | 'closed';
  reason?: string;
  opens_at?: string;
  closes_at?: string;
  reopens_at?: string;
};

export type PaymentChannel = {
  key: 'promptpay_qr' | 'cash' | 'thai_chuay_thai';
  name: string;
};

export type OptionRule = {
  category_id: string;
  option_id: string;
  requires_any: string[];
};

type MenuStateData = {
  server_time: string;
  shop: ShopData;
  preorder_minutes: number;
  prep_minutes: number;
  payment_channels: PaymentChannel[];
  items: ItemState[];
  options: OptionState[];
  option_rules?: OptionRule[];
};

type InternalState = {
  data: MenuStateData | null;
  /** serverTime - localTime at last fetch (ms) */
  serverTimeOffset: number;
};

/* ── Module-level singleton ──────────────────────────────── */
let _state: InternalState = { data: null, serverTimeOffset: 0 };
const _listeners = new Set<() => void>();
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _fetching = false;
let _globalSetup = false;

function _notify() {
  _listeners.forEach(fn => fn());
}

async function _fetch() {
  if (_fetching) return;
  _fetching = true;
  try {
    const { data, error } = await supabase.rpc('bp_public_menu_state');
    if (!error && data && typeof data === 'object') {
      const md = data as MenuStateData;
      const localNow = Date.now();
      const serverNow = new Date(md.server_time).getTime();
      _state = { data: md, serverTimeOffset: serverNow - localNow };
      _notify();
    }
    // On error: keep last state silently
  } catch {
    // fail-closed: UI handles null state as loading
  } finally {
    _fetching = false;
  }
}

function _startPoll() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => void _fetch(), 30_000);
}

function _stopPoll() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function _setupGlobal() {
  if (_globalSetup) return;
  _globalSetup = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _stopPoll();
    } else {
      void _fetch();
      _startPoll();
    }
  });
  window.addEventListener('focus', () => void _fetch());
}

/* ── Time helpers ────────────────────────────────────────── */
function _serverNow(): number {
  return Date.now() + _state.serverTimeOffset;
}

/** Current server-corrected time in ms — use with formatNextOpenForLang(). */
export function getServerNow(): number {
  return _serverNow();
}

/* ── Public helpers (read current module-level state) ────── */

export function isItemUnavailable(id: string): boolean {
  if (!_state.data) return false;
  const item = _state.data.items.find(i => i.id === id);
  if (!item) return false;
  if (item.status === 'limited') return false; // limited = still orderable
  if (item.restore_at) {
    if (_serverNow() >= new Date(item.restore_at).getTime()) return false;
  }
  return true;
}

export function itemRestoreAt(id: string): string | null {
  if (!_state.data) return null;
  return _state.data.items.find(i => i.id === id)?.restore_at ?? null;
}

export function isOptionUnavailable(id: string): boolean {
  if (!_state.data) return false;
  const opt = _state.data.options.find(o => o.id === id);
  if (!opt) return false;
  if (opt.restore_at) {
    if (_serverNow() >= new Date(opt.restore_at).getTime()) return false;
  }
  return true;
}

export function getServerTime(): string | null {
  return _state.data?.server_time ?? null;
}

export function getShop(): ShopData | null {
  return _state.data?.shop ?? null;
}

export function getPaymentChannels(): PaymentChannel[] {
  return _state.data?.payment_channels ?? [];
}

export function getPrepMinutes(): number {
  return _state.data?.prep_minutes ?? SHOP.prepMinutes;
}

export function getOptionRules(): OptionRule[] {
  return _state.data?.option_rules ?? [];
}

export async function refreshMenuState(): Promise<void> {
  _fetching = false;
  await _fetch();
}

/* ── Cart-level helpers ──────────────────────────────────── */
export function getCartIssues(
  items: Array<{ cartId: string; itemId: string; optionIds: string[] }>
): Map<string, { itemUnavailable: boolean; unavailableOptionIds: string[] }> {
  const map = new Map<string, { itemUnavailable: boolean; unavailableOptionIds: string[] }>();
  for (const item of items) {
    const itemUnavailable = isItemUnavailable(item.itemId);
    const unavailableOptionIds = item.optionIds.filter(id => isOptionUnavailable(id));
    if (itemUnavailable || unavailableOptionIds.length > 0) {
      map.set(item.cartId, { itemUnavailable, unavailableOptionIds });
    }
  }
  return map;
}

export function cartHasBlocking(
  items: Array<{ itemId: string; optionIds: string[] }>
): boolean {
  return items.some(
    item => isItemUnavailable(item.itemId) || item.optionIds.some(id => isOptionUnavailable(id))
  );
}

/* ── Server shop status ──────────────────────────────────── */

/** ShopStatus extended with server-sourced fields. */
export type ServerShopStatus = ShopStatus & {
  /** null = server data not yet loaded */
  serverShopStatus: 'open' | 'preorder' | 'closed' | null;
  /** true while waiting for first successful server response */
  isLoading: boolean;
  /** "HH:MM" Bangkok closing time — available when status is open */
  closesAtHHMM?: string;
  /** Raw next-open datetime — use with formatNextOpenForLang() for bilingual display */
  nextOpenAt?: Date;
  /** HH:MM Bangkok time of opens_at — only when serverShopStatus === 'preorder' */
  preorderOpensAtHHMM?: string;
};

function _mapToServerShopStatus(): ServerShopStatus {
  /* ── PREVIEW_OPEN: force open in Vercel preview deploys ── */
  const isPreviewEnv = import.meta.env.VITE_VERCEL_ENV === 'preview';
  const previewOpen  = isPreviewEnv && import.meta.env.VITE_PREVIEW_OPEN === 'true';
  if (previewOpen) {
    const serverNow = _serverNow();
    const nowBkk    = new Date(serverNow + 7 * 3_600_000);
    const nowMin    = nowBkk.getUTCHours() * 60 + nowBkk.getUTCMinutes();
    const prepMin   = _state.data?.prep_minutes ?? SHOP.prepMinutes;
    const asapMin   = roundUp5(nowMin + prepMin);
    return {
      isOpen:           true,
      slots:            [{ label: minToHHMM(asapMin), diffMin: prepMin, value: null, isAsap: true }],
      nextOpenMsg:      '',
      previewOpen:      true,
      forcedClosed:     false,
      reopenAt:         null,
      serverShopStatus: _state.data ? 'open' : null,
      isLoading:        !_state.data,
    };
  }

  /* ── FORCE_CLOSED_UNTIL: client-side emergency override ── */
  const forceUntilStr = import.meta.env.VITE_FORCE_CLOSED_UNTIL as string | undefined;
  if (forceUntilStr) {
    const reopenAt  = new Date(forceUntilStr);
    const serverNow = _serverNow();
    if (!isNaN(reopenAt.getTime()) && serverNow < reopenAt.getTime()) {
      return {
        isOpen:           false,
        slots:            [],
        nextOpenMsg:      '',
        previewOpen:      false,
        forcedClosed:     true,
        reopenAt,
        serverShopStatus: _state.data ? (_state.data.shop.status as 'open' | 'preorder' | 'closed') : null,
        isLoading:        !_state.data,
      };
    }
  }

  /* ── Loading: server hasn't responded yet ────────────── */
  const shopData = _state.data?.shop;
  if (!shopData) {
    return {
      isOpen:           false,
      slots:            [],
      nextOpenMsg:      '',
      previewOpen:      false,
      forcedClosed:     false,
      reopenAt:         null,
      serverShopStatus: null,
      isLoading:        true,
    };
  }

  /* ── Closed ───────────────────────────────────────────── */
  if (shopData.status === 'closed') {
    const openIso      = shopData.opens_at ?? shopData.reopens_at;
    const nextOpenAt   = openIso ? new Date(openIso) : undefined;
    const nextOpenMsg_ = openIso ? nextOpenMsg(openIso, _serverNow()) : '';
    return {
      isOpen:           false,
      slots:            [],
      nextOpenMsg:      nextOpenMsg_,
      nextOpenAt,
      previewOpen:      false,
      forcedClosed:     !!shopData.reopens_at,
      reopenAt:         shopData.reopens_at ? new Date(shopData.reopens_at) : null,
      serverShopStatus: 'closed',
      isLoading:        false,
    };
  }

  /* ── Preorder ─────────────────────────────────────────── */
  if (shopData.status === 'preorder') {
    const prepMin = _state.data!.prep_minutes ?? SHOP.prepMinutes;
    if (!shopData.opens_at) {
      // opens_at missing: treat as loading/unknown
      return {
        isOpen:           false,
        slots:            [],
        nextOpenMsg:      '',
        previewOpen:      false,
        forcedClosed:     false,
        reopenAt:         null,
        serverShopStatus: 'preorder',
        isLoading:        false,
      };
    }
    const opensAtDate = new Date(shopData.opens_at);
    const opensAtBkk  = new Date(opensAtDate.getTime() + 7 * 3_600_000);
    const opensAtMin  = opensAtBkk.getUTCHours() * 60 + opensAtBkk.getUTCMinutes();
    const pickupMin   = opensAtMin + prepMin;
    const serverNow   = _serverNow();
    const nowBkk      = new Date(serverNow + 7 * 3_600_000);
    const nowMin      = nowBkk.getUTCHours() * 60 + nowBkk.getUTCMinutes();
    const slot: TimeSlot = {
      label:   minToHHMM(pickupMin),
      diffMin: pickupMin - nowMin,
      value:   null,
      isAsap:  true,
    };
    return {
      isOpen:               true,
      slots:                [slot],
      nextOpenMsg:          '',
      previewOpen:          false,
      forcedClosed:         false,
      reopenAt:             null,
      serverShopStatus:     'preorder',
      isLoading:            false,
      preorderOpensAtHHMM:  minToHHMM(opensAtMin),
    };
  }

  /* ── Open: compute slots from server closes_at + server time ── */
  const prepMin   = _state.data!.prep_minutes ?? SHOP.prepMinutes;
  const serverNow = _serverNow();
  const nowBkk    = new Date(serverNow + 7 * 3_600_000);
  const nowMin    = nowBkk.getUTCHours() * 60 + nowBkk.getUTCMinutes();

  let closeMin: number;
  let closesAtHHMM: string | undefined;
  if (shopData.closes_at) {
    const closesAtBkk = new Date(new Date(shopData.closes_at).getTime() + 7 * 3_600_000);
    closeMin     = closesAtBkk.getUTCHours() * 60 + closesAtBkk.getUTCMinutes();
    closesAtHHMM = minToHHMM(closeMin);
  } else {
    // closes_at missing: keep slots empty (near-close or data issue)
    return {
      isOpen:           true,
      slots:            [],
      nextOpenMsg:      '',
      previewOpen:      false,
      forcedClosed:     false,
      reopenAt:         null,
      serverShopStatus: 'open',
      isLoading:        false,
    };
  }

  const slots: TimeSlot[] = [];
  const seen  = new Set<number>();

  const asapMin = roundUp5(nowMin + prepMin);
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

  return {
    isOpen:           true,
    slots,
    nextOpenMsg:      '',
    previewOpen:      false,
    forcedClosed:     false,
    reopenAt:         null,
    serverShopStatus: 'open',
    isLoading:        false,
    closesAtHHMM,
  };
}

/* ── Hooks ───────────────────────────────────────────────── */
export function useMenuState() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(n => n + 1);
    _listeners.add(listener);
    if (!_state.data) void _fetch();
    _startPoll();
    _setupGlobal();
    return () => { _listeners.delete(listener); };
  }, []);

  return { isItemUnavailable, itemRestoreAt, isOptionUnavailable, getServerTime, tick };
}

/**
 * React hook: shop status sourced entirely from server menu-state poll.
 * Returns isLoading=true until first server response arrives.
 * Updates every time the poll fires (~30 s).
 */
export function useShopStatusServer(): ServerShopStatus {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(n => n + 1);
    _listeners.add(listener);
    if (!_state.data) void _fetch();
    _startPoll();
    _setupGlobal();
    return () => { _listeners.delete(listener); };
  }, []);

  return _mapToServerShopStatus();
}
