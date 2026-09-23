# UX review brief: sanitizing edge-function error responses

## Product
ThePickleHub — bilingual pickleball web app, ~95% Vietnamese users, mobile-dominant
(mid-tier Android on 4G), also a Capacitor native shell. VI is the primary language;
English is secondary. Users often arrive via a Facebook deep link to a single page.

## The change under review
A security backlog (CodeQL) wants to stop edge functions / Cloudflare Workers from
returning raw `err.message` / stack traces in HTTP error response bodies. Today the
copy-pasted pattern in ~6 backend files is:

    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), { status: 500, ...corsHeaders });
    }

The proposed fix: a shared "safe error response" helper that strips the raw message/stack
and returns a generic body on unexpected errors.

## What the CLIENT does with error bodies today (the UX-critical part)
Two distinct client patterns coexist:

1. **Stable-code pattern (the good one, already in the highest-traffic flow — event
   registration via phone OTP).** The server returns a body like `{ "code": "event_full" }`
   or `{ "code": "slot_required" }`. The client reads the `code` field out of the response,
   and maps it to friendly Vietnamese copy via a switch:
       case "event_full": return reg.eventFull;   // "Giải đã đủ người"
       case "slot_required": return reg.slotRequired;
       default: return reg.networkError;           // "Lỗi mạng"
   The `code` is a stable machine token, NOT a stack trace. It is safe and is the whole
   basis of the localized error UX.

2. **Raw-message pattern (the fragile one).** ~83 client sites do
   `toast({ description: error.message || "Có lỗi xảy ra" })`. For calls made through the
   Supabase JS SDK's `functions.invoke`, a non-2xx response is wrapped as a generic
   `FunctionsHttpError` whose `.message` is literally "Edge Function returned a non-2xx
   status code" (English, technical) — the real body is hidden on `error.context`. So most
   of these sites ALREADY show either that English string or their own VI fallback; they
   rarely surface the server's `err.message` at all. One dialog (team invite) manually
   string-parses the body to recover a message.

## The 7 flagged functions and who calls them
None are on the anonymous high-traffic surface. They are: a backend-to-backend HMAC
ingest, three Cloudflare Workers (cron/no UI), a blog-blast admin function, a news
translation cron, and a shared auth helper whose 3 leaking call sites are DUPR
admin/test-fire endpoints. The user-facing flows in the app more broadly are: schedule a
livestream (creator), invite a team to a tournament (captain), delete account, register
for an event (phone OTP — highest traffic), DUPR link/submit.

## Questions for you
1. If the shared helper collapses ALL error bodies into a generic `{ error: "Internal
   server error" }` and DROPS the `code` field, what breaks in the UX, and how bad is it?
2. Should the sanitization distinguish "deliberate business/validation errors" (safe to
   show, carry a `code`) from "unexpected exceptions" (sanitize)? How should the helper
   signature encode that so a tired solo dev doesn't get it wrong at 2am?
3. The current fallback English strings ("Edge Function returned a non-2xx status code",
   raw err.message) already leak English/technical text to a 95%-Vietnamese audience. Is
   this security task the right moment to also introduce a client-side error-code→VI-copy
   map more broadly, or is that scope creep? Give a concrete recommendation.
4. Name specific VI microcopy for a generic "unexpected server error" toast that a
   court-side user on 4G would actually understand — VI primary, EN secondary.

Be specific and concrete. Name the exact element and the exact fix. No platitudes.
