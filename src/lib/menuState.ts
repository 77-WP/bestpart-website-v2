import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { computeShopStatus, minToHHMM, SHOP, type ShopStatus, type TimeSlot } from '../config/shop';

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
    // On error: keep last state silently (fail-open)
  } catch {
    // fail-open: server validates again at order time
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

/** ShopStatus extended with server-side shop status field. */
export type ServerShopStatus = ShopStatus & {
  /** null = server data not yet loaded (using local fallback) */
  serverShopStatus: 'open' | 'preorder' | 'closed' | null;
  /** HH:MM Bangkok time of opens_at — only when serverShopStatus === 'preorder' */
  preorderOpensAtHHMM?: string;
};

function _mapToServerShopStatus(): ServerShopStatus {
  const shopData = _state.data?.shop;
  if (!shopData) {
    return { ...computeShopStatus(), serverShopStatus: null };
  }

  if (shopData.status === 'closed') {
    const local = computeShopStatus();
    return {
      isOpen:       false,
      slots:        [],
      nextOpenMsg:  local.nextOpenMsg,
      previewOpen:  false,
      forcedClosed: !!shopData.reopens_at,
      reopenAt:     shopData.reopens_at ? new Date(shopData.reopens_at) : null,
      serverShopStatus: 'closed',
    };
  }

  if (shopData.status === 'preorder') {
    const prepMin = _state.data?.prep_minutes ?? SHOP.prepMinutes;
    if (!shopData.opens_at) {
      return { ...computeShopStatus(), serverShopStatus: 'preorder' };
    }
    const opensAtDate = new Date(shopData.opens_at);
    const opensAtBkk  = new Date(opensAtDate.getTime() + 7 * 3_600_000);
    const opensAtMin  = opensAtBkk.getUTCHours() * 60 + opensAtBkk.getUTCMinutes();
    const pickupMin   = opensAtMin + prepMin; // no rounding per spec
    const serverNow   = _serverNow();
    const nowBkk      = new Date(serverNow + 7 * 3_600_000);
    const nowMin      = nowBkk.getUTCHours() * 60 + nowBkk.getUTCMinutes();
    const slot: TimeSlot = {
      label:   minToHHMM(pickupMin),
      diffMin: pickupMin - nowMin,
      value:   null,   // asap → server picks exact time
      isAsap:  true,
    };
    return {
      isOpen:       true,
      slots:        [slot],
      nextOpenMsg:  '',
      previewOpen:  false,
      forcedClosed: false,
      reopenAt:     null,
      serverShopStatus:     'preorder',
      preorderOpensAtHHMM:  minToHHMM(opensAtMin),
    };
  }

  // status === 'open'
  const base = computeShopStatus();
  return { ...base, serverShopStatus: 'open' };
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
 * React hook: shop status sourced from the server menu-state poll.
 * Falls back to computeShopStatus() until server data arrives.
 * Updates every time the menu-state poll fires (~30 s).
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
