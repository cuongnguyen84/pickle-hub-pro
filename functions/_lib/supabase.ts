/**
 * Supabase client factory for Cloudflare Pages Functions.
 * Uses the service role key for server-side data fetching.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type { SupabaseClient };

export function createSupabaseClient(env: {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
