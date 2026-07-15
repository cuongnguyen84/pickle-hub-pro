type CorsHeaderMap = Readonly<Record<string, string>>;

function createCorsHeaders(
  allowHeaders: string,
  allowMethods?: string,
  extraHeaders: Record<string, string> = {},
): CorsHeaderMap {
  return Object.freeze({
    "Access-Control-Allow-Origin": "*",
    ...(allowMethods ? { "Access-Control-Allow-Methods": allowMethods } : {}),
    "Access-Control-Allow-Headers": allowHeaders,
    ...extraHeaders,
  });
}

const STANDARD_REQUEST_HEADERS =
  "authorization, x-client-info, apikey, content-type";
const CRON_REQUEST_HEADERS = `${STANDARD_REQUEST_HEADERS}, x-cron-secret`;
const SUPABASE_CLIENT_REQUEST_HEADERS =
  `${STANDARD_REQUEST_HEADERS}, x-supabase-client-platform, ` +
  "x-supabase-client-platform-version, x-supabase-client-runtime, " +
  "x-supabase-client-runtime-version";

// Default for handlers using _shared/auth.ts. Keep the broad method set and
// cron header for backward compatibility; specialized endpoints use one of
// the narrower presets below.
export const corsHeaders = createCorsHeaders(
  CRON_REQUEST_HEADERS,
  "GET, POST, OPTIONS",
);

export const simpleCorsHeaders = createCorsHeaders(STANDARD_REQUEST_HEADERS);
export const cronCorsHeaders = createCorsHeaders(CRON_REQUEST_HEADERS);
export const cronPostCorsHeaders = createCorsHeaders(
  CRON_REQUEST_HEADERS,
  "POST, OPTIONS",
);
export const supabaseClientCorsHeaders = createCorsHeaders(
  SUPABASE_CLIENT_REQUEST_HEADERS,
);
export const supabaseClientPostCorsHeaders = createCorsHeaders(
  SUPABASE_CLIENT_REQUEST_HEADERS,
  "POST, OPTIONS",
);
export const clientEventCorsHeaders = createCorsHeaders(
  "content-type, authorization, apikey",
  "POST, OPTIONS",
);
export const muxWebhookCorsHeaders = createCorsHeaders(
  `${STANDARD_REQUEST_HEADERS}, mux-signature`,
);
export const newsletterCorsHeaders = createCorsHeaders(
  "authorization, content-type, apikey, x-client-info",
  "POST, OPTIONS",
  { "Content-Type": "application/json" },
);
export const authWebhookCorsHeaders = createCorsHeaders(
  `${STANDARD_REQUEST_HEADERS}, x-supabase-webhook-secret`,
);
export const internalSecretCorsHeaders = createCorsHeaders(
  `${STANDARD_REQUEST_HEADERS}, x-internal-secret`,
);
export const socialCaptionCorsHeaders = createCorsHeaders(
  "authorization, content-type, x-auth-secret, apikey, x-client-info",
  "POST, OPTIONS",
  { "Content-Type": "application/json" },
);
export const videoProxyCorsHeaders = createCorsHeaders(
  `${STANDARD_REQUEST_HEADERS}, range`,
  "GET, HEAD, OPTIONS",
  { "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges" },
);
