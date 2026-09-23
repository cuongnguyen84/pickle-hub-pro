# Change under review: close 28 CodeQL alerts on a live solo-run product

Product: bilingual pickleball platform, ~2000 real users, one operator. React SPA
+ Supabase edge functions (Deno) + Cloudflare Pages Functions (SSR for bots) +
Cloudflare Workers (scrapers/cron). CI runs CodeQL; 28 open alerts, goal 28 -> 0.

## The alerts (grouped)
1. js/stack-trace-exposure (7): error handlers put `err.message` into the JSON
   response body. Sites: 4 Supabase edge functions (pro-tour-ingest [HMAC
   backend-to-backend], news-translate [cron], send-blog-blast [admin], and 3
   DUPR admin/test endpoints whose Response is built by a SHARED helper
   `_shared/auth.ts` jsonResponse()), plus 3 Cloudflare Workers.
2. js/incomplete-multi-character-sanitization (6): regex HTML sanitizers that do
   a single-pass strip of `<script>`, `<style>`, and `on*=` event handlers. One
   is in the SSR/prerender lib served to Googlebot and cached in a KV store keyed
   by a manual version string; others in a worker + edge fn + scraper.
3. js/incomplete-url-substring-sanitization (2): `url.includes("googleusercontent.com")`.
4. js/xss-through-dom (3): admin-only React pages feeding input state into
   <img src> / <a href>.
5. js/insecure-randomness (2): Math.random() feeding username-candidate generation.
6. js/incomplete-sanitization (2): ILIKE escape misses backslash in a
   user-facing DUPR search edge function.
7. js/overly-large-range (1): auth open-redirect guard uses char class `[ -\s]`.
   Verified at runtime: this class matches a literal hyphen, so TODAY any
   post-login redirect path containing "-" (all slug routes) is rejected and the
   user is bounced to "/".
8. Misc: bad-tag-filter, double-escaping, tainted-format-string (console.error).

## Deploy mechanics that constrain the fix
- A CI "deploy guard" watches pushes to main. ANY diff under
  `supabase/functions/_shared/**` triggers "redeploy ALL ~50 functions",
  looped sequentially with `set -e`. A mid-loop failure leaves the fleet
  partially redeployed. There is NO atomic rollback: recovery is re-running
  `supabase functions deploy <name>` per function from a good checkout.
- The 3 DUPR stack-trace leaks are attributed by CodeQL to the shared
  `jsonResponse()` in `_shared/auth.ts`, but the tainted `err.message` is
  actually constructed in the 3 CALLER functions. Fixing at the callers
  redeploys only those 3 functions; "fixing" the shared helper redeploys all 50.
- Cloudflare Workers deploy separately via `wrangler deploy`, run manually per
  worker dir. Merging a worker code fix closes the CodeQL alert (source scan)
  but the RUNNING worker keeps leaking until someone manually deploys it.
- Edge functions all run verify_jwt=false (platform JWT workaround); "public vs
  internal" is decided by each function's own auth check, not the flag.

## What I want from you
Find the SPECIFIC production failure this cleanup causes. Concrete mechanism,
trigger, user-visible symptom. Rank which of the 28 (if any) is an urgent
true-positive to fix first. Reject generic risk language. If the batch is
genuinely low-risk hygiene, say so plainly.
