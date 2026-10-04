// localStorage helper for persisting recent order IDs on this device
// key: 'bp_orders' — array of { id, created_at, name? }, capped at MAX_ORDERS

const KEY = 'bp_orders';
const MAX_ORDERS = 20;
const HISTORY_DAYS = 30;

export type LocalOrder = { id: string; created_at: string; name?: string };

export function getLocalOrders(): LocalOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLocalOrderIds(): string[] {
  return getLocalOrders().map(o => o.id);
}

/** Prepend order to list; dedup by id; cap at MAX_ORDERS. */
export function saveLocalOrder(id: string, created_at: string, name?: string): void {
  try {
    const existing = getLocalOrders().filter(o => o.id !== id);
    const entry: LocalOrder = name ? { id, created_at, name } : { id, created_at };
    const updated = [entry, ...existing].slice(0, MAX_ORDERS);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — fail silently
  }
}

/** Remove entries older than HISTORY_DAYS that are not in the active set.
 *  Call on Orders page load after determining which orders are currently active. */
export function pruneOldOrders(activeIds: Set<string>): void {
  try {
    const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const kept = getLocalOrders().filter(o => {
      if (activeIds.has(o.id)) return true;
      return new Date(o.created_at).getTime() > cutoff;
    });
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch { /* fail silently */ }
}
