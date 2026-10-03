// localStorage helper for persisting recent order IDs on this device
// key: 'bp_orders' — array of { id, created_at }, capped at MAX_ORDERS

const KEY = 'bp_orders';
const MAX_ORDERS = 20;

export type LocalOrder = { id: string; created_at: string };

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
export function saveLocalOrder(id: string, created_at: string): void {
  try {
    const existing = getLocalOrders().filter(o => o.id !== id);
    const updated = [{ id, created_at }, ...existing].slice(0, MAX_ORDERS);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — fail silently
  }
}
