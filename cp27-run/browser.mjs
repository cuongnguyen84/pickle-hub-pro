// Browser actors for CP27.
//
// Each actor gets its OWN Playwright context — separate localStorage, separate
// cookies, separate service worker registration. Nothing is shared, so an
// assertion about "the admin at aal1" cannot accidentally be answered by an
// aal2 token left behind by the previous journey.
//
// The session is a REAL one: obtained from /auth/v1/token (and, for aal2, from
// a real TOTP challenge), then written into the storage key supabase-js itself
// reads. That is not a bypass of AdminMFAGate — the gate reads the JWT's `aal`
// claim, and the claim here was minted by Supabase after verifying a real code.
// The alternative, driving the login form, would test GoTrue's form rather than
// this application, and this app's sign-in is OTP-based so it would need a
// mailbox.
import { chromium } from "@playwright/test";
import { REF, SITE } from "./env.mjs";
import { session, claims } from "./lib.mjs";

const STORAGE_KEY = `sb-${REF}-auth-token`;

let browser;
export async function launch() {
  browser = await chromium.launch();
  return browser;
}
export async function close() {
  await browser?.close();
}

/**
 * A fresh context carrying `who`'s session. `who === "anon"` gets no session at
 * all — and is asserted to have none, because "logged out" that is quietly
 * logged in is the failure this whole separation exists to prevent.
 */
export async function actor(who, { aal2 = false, viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block" });
  let expected = null;

  if (who !== "anon") {
    const s = await session(who, { aal2 });
    expected = { sub: s.sub, aal: s.aal };
    // Plain JSON: the auth-js bundled here has no `base64-` envelope. Writing
    // the whole session GoTrue returned, not a hand-built subset, so the client
    // sees exactly what a real sign-in would have left behind.
    await ctx.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [STORAGE_KEY, JSON.stringify(s.raw)],
    );
  }

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`    [pageerror ${who}] ${e.message.slice(0, 160)}`));
  const a = { who, ctx, page, expected, goto: (p, o) => goto(page, p, o) };
  // Land on the origin once, so localStorage exists to be read from and the
  // init script has run. about:blank has no storage and no identity to assert.
  await a.goto("/shop");
  return a;
}

/**
 * Navigate with a couple of retries. Cloudflare intermittently drops a
 * connection when contexts are opened back to back; a flaky transport must not
 * be reported as a product failure, and a silent retry-forever must not hide a
 * real outage either — three tries, then throw.
 */
export async function goto(page, path, opts = {}) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      return await page.goto(path.startsWith("http") ? path : SITE + path, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
        ...opts,
      });
    } catch (e) {
      last = e;
      await page.waitForTimeout(2000 * (i + 1));
    }
  }
  throw last;
}

/**
 * Assert the browser is who it claims to be, from inside the page, before any
 * journey that depends on it.
 */
export async function assertIdentity(a) {
  const seen = await a.page.evaluate((k) => {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const tok = JSON.parse(raw).access_token;
    const c = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { sub: c.sub, aal: c.aal, role: c.role };
  }, STORAGE_KEY);

  if (a.who === "anon") {
    if (seen) throw new Error(`anonymous context carries a session for ${seen.sub}`);
    return { sub: null, aal: null };
  }
  if (!seen) throw new Error(`${a.who} context has no session`);
  if (seen.sub !== a.expected.sub) throw new Error(`${a.who}: sub mismatch`);
  if (seen.aal !== a.expected.aal) throw new Error(`${a.who}: expected ${a.expected.aal}, page has ${seen.aal}`);
  return seen;
}

export { SITE, claims };
