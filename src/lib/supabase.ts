import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

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
}
