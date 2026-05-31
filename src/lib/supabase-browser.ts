/**
 * REFACTOR-P3-01: Browser-side Supabase client used exclusively for Realtime
 * broadcast channels in the live-session chat.
 *
 * Uses the anon key — NEVER the service role key, which would leak privileges
 * to every visitor. Realtime broadcast channels do not query tables, so the
 * deny-anon RLS policies from REFACTOR-P2-01 don't apply.
 */
import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(URL, ANON, {
  auth:     { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
