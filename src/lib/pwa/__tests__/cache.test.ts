import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  it("uses NetworkOnly for the Supabase /rest/ rule", () => {
    // Grab the object literal following the /rest/ urlPattern.
    const idx = CONFIG.indexOf("supabase\\.co\\/rest");
    expect(idx).toBeGreaterThan(-1);
    const block = CONFIG.slice(idx, idx + 400);
    const handler = block.match(/handler:\s*"(\w+)"/)?.[1];
    expect(handler).toBe("NetworkOnly");
  });

  it("does not write a caching handler or cacheName for REST", () => {
    const idx = CONFIG.indexOf("supabase\\.co\\/rest");
    // Slice only up to the NEXT rule so we don't read the following block.
    const rest = CONFIG.slice(idx);
    const block = rest.slice(0, rest.indexOf("urlPattern", 1));
    expect(block).not.toContain('handler: "NetworkFirst"');
    expect(block).not.toContain('handler: "StaleWhileRevalidate"');
    expect(block).not.toContain('handler: "CacheFirst"');
    expect(block).not.toContain('cacheName: "supabase-rest"');
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
