import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const _missing: string[] = []
if (!supabaseUrl)     _missing.push('VITE_SUPABASE_URL')
if (!supabaseAnonKey) _missing.push('VITE_SUPABASE_ANON_KEY')
if (_missing.length)  _missing.forEach(v => console.error(`[supabase] Missing env var: ${v}`))

/** True when required Supabase env vars are absent — show config-error page instead of the app */
export const supabaseConfigMissing = _missing.length > 0

export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  { realtime: { params: { eventsPerSecond: 10 } } },
)

/* Order status → step index */
export const STATUS_STEP: Record<string, number> = {
  pending:    0,
  preparing:  1,
  ready:      2,
  completed:  3,
}

export type OrderRow = {
  id: string
  status: string
  items: unknown
  grand_total: number
  subtotal: number
  discount_amount: number
  fulfillment_type: string
  checkout_payment_method: string | null
  order_number: number
  created_at: string
  pickup_time: string | null
}

/* ── get-order Edge Function response ───────────────────── */
export type GetOrderItem = {
  name: string
  name_en?: string
  qty: number
  unit_price: number
  line_total: number
  variant?: string
  modifiers?: { group: string; name: string; price: number }[]
}

export type GetOrderResult = {
  status: string
  payment_status: string
  payment_method: string | null
  fulfillment_type: string
  ordered_at: string
  estimated_ready_at: string | null
  requested_ready_at: string | null
  ready_at: string | null
  picked_up_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  customer_arrived_at: string | null
  arrival_acked_at: string | null
  call_name: string | null
  vehicle: unknown
  cutlery: boolean
  condiments: boolean
  customer_note: string | null
  grand_total: number
  store_name: string | null
  items: GetOrderItem[]
}

/**
 * Maps raw API statuses (from get-order / create-order) to the UI status
 * values used by Track, Orders, Pay, and TabBar.
 * Keep this as the single source of truth for status normalisation.
 */
export function normalizeOrderStatus(raw: string): string {
  switch (raw) {
    case 'payment_pending':        return 'awaiting_payment'
    case 'created':
    case 'accepted':
    case 'queued':                 return 'pending'
    case 'cooking':
    case 'assembly':               return 'preparing'
    case 'picked_up':              return 'ready'
    case 'expired':                return 'expired'
    case 'refunded':
    case 'partially_refunded':     return 'completed'
    default:                       return raw   // pass-through: pending, preparing, ready, completed, cancelled, awaiting_payment
  }
}

/**
 * Parse the error body from a supabase-js FunctionsHttpError.
 * In supabase-js, error.context is a Response object — read it with clone().json().
 */
export async function readFnError(err: unknown): Promise<{ code: string; status: number | null }> {
  try {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      const json = await context.clone().json();
      return { code: (json as { error?: string }).error ?? 'fallback', status: context.status };
    }
  } catch { /* ignore */ }
  return { code: 'fallback', status: null };
}
