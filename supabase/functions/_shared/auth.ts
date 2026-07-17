// ============================================================================
// _shared/auth.ts — JWT verification helper for the ES256/HS256 workaround
// ----------------------------------------------------------------------------
// All Bet #1 user-facing functions ship with `verify_jwt = false` in
// supabase/config.toml. The Supabase Edge gateway therefore does NOT
// validate the Authorization header — we must validate it inside the
// function ourselves by passing the bearer token to supabase.auth.getUser(),
// which calls the Auth API directly (handles ES256 correctly per the
// existing CLAUDE.md workaround).
//
// Usage in a function:
//
//   import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
//   import { getAuthUser } from "../_shared/auth.ts";
//
//   Deno.serve(async (req) => {
//     const supabase = createClient(
//       Deno.env.get("SUPABASE_URL") ?? "",
//       Deno.env.get("SUPABASE_ANON_KEY") ?? "",
//     );
//     const user = await getAuthUser(req, supabase);
//     if (!user) return new Response(JSON.stringify({ error: "unauthorized" }),
//                                    { status: 401 });
//     // ... function body ...
//   });
// ============================================================================

import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "./cors.ts";

/**
 * Extract + verify the bearer token from a Request, returning the
 * authenticated user or null. Never throws — caller decides 401 vs 403.
 */
export async function getAuthUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** JSON helper — uniform error shape across all 8 social functions. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
