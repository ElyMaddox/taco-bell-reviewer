import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in the browser: row level security in the
// database decides what each signed-in user can read and write.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://jfmrpjkctzszixgvwgvb.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_Y-dTA2I0luaXdVSE39-lYw_XpRVNajk'

export const supabase = createClient(url, key)

export type LocationStat = {
  id: number
  name: string
  address: string
  lat: number
  lng: number
  avg_score: number | null
  review_count: number
}

export type MenuItem = { id: number; name: string; category: string | null }

export type Review = {
  id: number
  user_id: string
  location_id: number
  item_id: number
  score: number
  notes: string | null
  visited_on: string
  created_at: string
  profiles: { display_name: string } | null
  menu_items: { name: string } | null
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#8a8a8a'
  // 1 = red, 3 = amber, 5 = green
  const stops = ['#d7263d', '#f46036', '#f4b400', '#8bc34a', '#1b998b']
  const i = Math.min(4, Math.max(0, Math.round(score) - 1))
  return stops[i]
}
