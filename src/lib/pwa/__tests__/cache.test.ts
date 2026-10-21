import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { purgeAuthSensitiveCaches, __AUTH_SENSITIVE_CACHES } from "../cache";

const CONFIG = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "vite.config.ts"),
  "utf8",
);

describe("service worker — Supabase REST must never be cached", () => {
  // Locks the fix for the shared-device data-leak: /rest/ responses are
  // per-user (RLS + bearer) and a URL-keyed cache could serve another
  // account's data offline. This test reds if anyone reverts the rule to a
  // caching strategy.
  //
  // 2026-08-13: the rule's urlPattern became `new RegExp` built from
  // SUPABASE_ORIGIN, because the old literal was pinned to the production host
  // and therefore matched NOTHING on staging — this safety rule was silently
  // absent on every other environment. The locator moved with it.
  //
  // Locating by text is the weak part of both tests here: when the pattern
  // changed, the first one went red (good) and the second went VACUOUS — its
  // assertions are all `not.toContain`, so a slice that found nothing passed
  // everything. Hence `expect(idx).toBeGreaterThan(-1)` in both, which is what
  // makes a missing rule fail instead of quietly succeed.
  const REST_RULE = "reEscape(SUPABASE_ORIGIN)}/rest/";

  it("uses NetworkOnly for the Supabase /rest/ rule", () => {
    const idx = CONFIG.indexOf(REST_RULE);
    expect(idx).toBeGreaterThan(-1);
    const block = CONFIG.slice(idx, idx + 400);
    const handler = block.match(/handler:\s*"(\w+)"/)?.[1];
    expect(handler).toBe("NetworkOnly");
  });

  it("does not write a caching handler or cacheName for REST", () => {
    const idx = CONFIG.indexOf(REST_RULE);
    expect(idx).toBeGreaterThan(-1);
    // Slice only up to the NEXT rule so we don't read the following block.
    const rest = CONFIG.slice(idx);
    const block = rest.slice(0, rest.indexOf("urlPattern", 1));
    expect(block).not.toContain('handler: "NetworkFirst"');
    expect(block).not.toContain('handler: "StaleWhileRevalidate"');
    expect(block).not.toContain('handler: "CacheFirst"');
    expect(block).not.toContain('cacheName: "supabase-rest"');
  });

  it("builds the rule from the configured origin, so it applies on every environment", () => {
    // The bug this replaces: a host-pinned literal here meant staging ran with
    // no REST caching rule at all. It happened to stay uncached because no
    // other rule matched — protection by accident, not by design.
    expect(CONFIG).toContain(`urlPattern: new RegExp(\`^\${${REST_RULE}\`)`);
  });
});

describe("service worker — active locale remains available offline", () => {
  it("keeps locale chunks out of precache but caches the requested one at runtime", () => {
    expect(CONFIG).toContain('"**/locale-*"');

    const idx = CONFIG.indexOf('cacheName: "locale-dictionaries"');
    expect(idx).toBeGreaterThan(-1);
    const block = CONFIG.slice(Math.max(0, idx - 700), idx + 300);
    expect(block).toContain('request.destination === "script"');
    expect(block).toContain("locale-(?:en|vi)");
    expect(block).toContain('handler: "CacheFirst"');
  });
});

describe("purgeAuthSensitiveCaches", () => {
  const originalCaches = (globalThis as { caches?: CacheStorage }).caches;

  afterEach(() => {
    (globalThis as { caches?: CacheStorage }).caches = originalCaches;
    vi.restoreAllMocks();
  });

  it("deletes every auth-sensitive cache by name", async () => {
    const deleted: string[] = [];
    (globalThis as { caches?: unknown }).caches = {
      delete: (name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
    };
    await purgeAuthSensitiveCaches();
    expect(deleted).toEqual([...__AUTH_SENSITIVE_CACHES]);
    expect(deleted).toContain("supabase-rest");
  });

  it("no-ops safely when Cache Storage is unavailable", async () => {
    (globalThis as { caches?: unknown }).caches = undefined;
    await expect(purgeAuthSensitiveCaches()).resolves.toBeUndefined();
  });

  it("swallows Cache Storage errors (private mode / quota)", async () => {
    (globalThis as { caches?: unknown }).caches = {
      delete: () => Promise.reject(new Error("quota")),
    };
    await expect(purgeAuthSensitiveCaches()).resolves.toBeUndefined();
  });
});
