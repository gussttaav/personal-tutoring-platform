// DB-02: Supabase client singleton for server-side use.
// Uses SERVICE_ROLE_KEY to bypass RLS — NextAuth session is the auth boundary.
// NEVER expose the service role key to the browser.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = createSupabaseClient();
