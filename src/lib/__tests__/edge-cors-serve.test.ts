import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authWebhookCorsHeaders,
  clientEventCorsHeaders,
  corsHeaders,
  cronCorsHeaders,
  cronPostCorsHeaders,
  internalSecretCorsHeaders,
  muxWebhookCorsHeaders,
  newsletterCorsHeaders,
  proTourIngestCorsHeaders,
  simpleCorsHeaders,
  socialCaptionCorsHeaders,
  supabaseClientCorsHeaders,
  supabaseClientPostCorsHeaders,
  videoProxyCorsHeaders,
  zaloCronCorsHeaders,
} from "../../../supabase/functions/_shared/cors";

const functionsDir = fileURLToPath(
  new URL("../../../supabase/functions/", import.meta.url),
);

const functionSources = new Map(
  readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
    .filter((entry) =>
      existsSync(
        new URL(
          `../../../supabase/functions/${entry.name}/index.ts`,
          import.meta.url,
        ),
      ),
    )
    .map((entry) => {
      const path = new URL(
        `../../../supabase/functions/${entry.name}/index.ts`,
        import.meta.url,
      );
      return [entry.name, readFileSync(path, "utf8")] as const;
    }),
);

function readTypeScriptSources(
  directory: string,
  relativeDirectory: string,
): Array<{ path: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return readTypeScriptSources(absolutePath, relativePath);
    }
    return entry.isFile() && entry.name.endsWith(".ts")
      ? [{ path: relativePath, source: readFileSync(absolutePath, "utf8") }]
      : [];
  });
}

const functionTreeSources = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .flatMap((entry) => {
    const directory = fileURLToPath(
      new URL(`../../../supabase/functions/${entry.name}/`, import.meta.url),
    );
    return readTypeScriptSources(directory, entry.name);
  });

const expectedPresetFiles: Record<string, string[]> = {
  simpleCorsHeaders: [
    "api-keys-admin-generate",
    "api-keys-admin-revoke",
    "api-keys-generate",
    "api-keys-list",
    "api-keys-revoke",
    "delete-account",
    "invite-team-to-tournament",
    "mux-create-livestream",
    "news-check",
    "news-ingest",
    "og-doubles-elimination",
    "og-flex-tournament",
    "og-image-club",
    "og-image-match",
    "og-image-player",
    "og-image-social-event",
    "og-live",
    "og-organization",
    "og-quick-table",
    "og-tournament",
    "og-video",
    "send-push-notification",
  ],
  cronCorsHeaders: [
    "feed-embeds-sync",
    "feed-generate",
    "mux-sync-assets",
    "news-translate",
  ],
  cronPostCorsHeaders: ["auto-archive-tournaments"],
  supabaseClientPostCorsHeaders: ["batch-view-events"],
  supabaseClientCorsHeaders: ["geo-check"],
  clientEventCorsHeaders: ["log-client-event"],
  muxWebhookCorsHeaders: ["mux-webhook"],
  newsletterCorsHeaders: ["newsletter-subscribe"],
  authWebhookCorsHeaders: ["send-auth-email"],
  internalSecretCorsHeaders: ["send-event-registration-email"],
  socialCaptionCorsHeaders: ["social-caption"],
  videoProxyCorsHeaders: ["video-thumbnail-proxy"],
  zaloCronCorsHeaders: ["zalo-token-refresh"],
  proTourIngestCorsHeaders: ["pro-tour-ingest"],
};

describe("Edge Function CORS and server entrypoints", () => {
  it("preserves the characterized CORS policy variants", () => {
    const origin = { "Access-Control-Allow-Origin": "*" };
    const standard = "authorization, x-client-info, apikey, content-type";
    const supabaseClient =
      `${standard}, x-supabase-client-platform, ` +
      "x-supabase-client-platform-version, x-supabase-client-runtime, " +
      "x-supabase-client-runtime-version";

    expect(corsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": `${standard}, x-cron-secret`,
    });
    expect(simpleCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers": standard,
    });
    expect(cronCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers": `${standard}, x-cron-secret`,
    });
    expect(cronPostCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": `${standard}, x-cron-secret`,
    });
    expect(supabaseClientCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers": supabaseClient,
    });
    expect(supabaseClientPostCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": supabaseClient,
    });
    expect(clientEventCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    });
    expect(muxWebhookCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers": `${standard}, mux-signature`,
    });
    expect(newsletterCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, content-type, apikey, x-client-info",
      "Content-Type": "application/json",
    });
    expect(authWebhookCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers":
        `${standard}, x-supabase-webhook-secret`,
    });
    expect(internalSecretCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Headers": `${standard}, x-internal-secret`,
    });
    expect(socialCaptionCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, content-type, x-auth-secret, apikey, x-client-info",
      "Content-Type": "application/json",
    });
    expect(videoProxyCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": `${standard}, range`,
      "Access-Control-Expose-Headers":
        "content-length, content-range, accept-ranges",
    });
    expect(zaloCronCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-cron-secret",
      "Content-Type": "application/json",
    });
    expect(proTourIngestCorsHeaders).toEqual({
      ...origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
  });

  it("routes every characterized CORS declaration through its exact preset", () => {
    expect(Object.values(expectedPresetFiles).flat()).toHaveLength(38);

    for (const [preset, functionNames] of Object.entries(expectedPresetFiles)) {
      for (const functionName of functionNames) {
        expect(functionSources.get(functionName), functionName).toContain(
          `import { ${preset} as corsHeaders } from "../_shared/cors.ts";`,
        );
      }
    }

    const combined = [...functionSources.values()].join("\n");
    expect(
      [...functionSources.values()].filter((source) =>
        source.includes('_shared/cors.ts"'),
      ),
      // 75 since P2a.2: shop-media-lifecycle imports the shared preset too.
    ).toHaveLength(75);
    expect(combined).not.toMatch(/const corsHeaders\s*=/i);
    expect(combined).not.toMatch(
      /import\s*\{[^}]*corsHeaders[^}]*\}\s*from\s*["']\.\.\/_shared\/auth\.ts["']/s,
    );

    for (const file of functionTreeSources) {
      expect(file.source, file.path).not.toMatch(
        /["']Access-Control-Allow-Origin["']\s*:/,
      );
    }
  });

  it("uses Deno.serve for every function entrypoint", () => {
    // 81 since P2a.2 added shop-media-lifecycle.
    expect(functionSources).toHaveLength(81);
    for (const [functionName, source] of functionSources) {
      const alias = source.match(/import\s+["']\.\.\/([^/]+)\/index\.ts["']/)?.[1];
      const effectiveSource = alias ? functionSources.get(alias) : source;
      expect(effectiveSource, `${functionName}${alias ? ` -> ${alias}` : ""}`).toContain(
        "Deno.serve(",
      );
      expect(source, functionName).not.toMatch(
        /deno\.land\/std@[^"']+\/http\/server\.ts/,
      );
    }
  });
});
