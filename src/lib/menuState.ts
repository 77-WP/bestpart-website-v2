import { useState, useEffect } from 'react';
import { supabase } from './supabase';

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

type MenuStateData = {
  server_time: string;
  items: ItemState[];
  options: OptionState[];
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

/* ── Hook ────────────────────────────────────────────────── */
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
