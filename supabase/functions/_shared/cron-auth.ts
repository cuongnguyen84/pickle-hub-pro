const jsonHeaders = { "Content-Type": "application/json" };

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * Fail-closed authentication for cron-only Edge Functions.
 *
 * The Supabase gateway cannot validate this project's ES256 user JWTs, so
 * scheduled functions use verify_jwt=false and must authenticate internally.
 * Callers must send `x-cron-secret: <CRON_SECRET>` on a POST request.
 *
 * Returns a rejection Response, or null when the request is authorized.
 */
export function requireCronRequest(
  req: Request,
  expectedSecret: string,
): Response | null {
  if (req.method !== "POST") {
    return jsonError("method_not_allowed", 405);
  }

  if (!expectedSecret) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return jsonError("cron_secret_not_configured", 503);
  }

  const presentedSecret = req.headers.get("x-cron-secret") ?? "";
  if (presentedSecret !== expectedSecret) {
    return jsonError("unauthorized", 401);
  }

  return null;
}
