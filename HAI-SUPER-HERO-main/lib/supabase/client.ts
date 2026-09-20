// Browser Supabase client. Uses the anon key — safe in the browser.
// Used for: realtime subscriptions, anon-allowed reads under RLS, sign-in.

import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
