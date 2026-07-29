# Follow-up nudge for SU-429781 — send to support@supabase.com

_Status: FINAL, ready to send — written 29/07 after verifying the outage
continued 27–29/07 with the self-heal paused. (Per Cuong: no mention of the
GitHub Actions budget — just the Supabase-side evidence.)_

---

Hi Tim,

Following up on my 26/07 reply (per-region analysis + live reproduction) — I
haven't heard back yet, and in the meantime we gathered even stronger evidence
confirming the failure model. Could you share the status of the edge-runtime
escalation?

## Regions stay poisoned indefinitely without a redeploy

Our hourly self-heal redeploys were paused from 27/07, so from **27/07 00:00 to
29/07 06:50 UTC there were zero deploys of any kind** — and poisoned regions
never recovered on their own:

- **us-east-1** returned NOT_FOUND_FUNCTION_BLOB for our 8 canary functions
  (`send-auth-email`, `phone-otp-send`, `create-payment-order`, `mux-webhook`,
  `geo-check`, `pro-tour-ingest`, `og-image-social-event`, `feed-embeds-sync`)
  on **every probe, every minute, for 3 days straight** (~480 hits/hour in
  `function_edge_logs`).
- **ap-southeast-1** went blob-404 for **all 75 functions** at 29/07 00:00 UTC
  and was still returning 404 at 06:50 UTC (verified live via the `x-region`
  header).
- **ap-northeast-2** (where our Vietnamese users route) lost 48 functions at
  29/07 00:00–01:00.
- **ap-northeast-1** (project home region) kept intermittently 404ing our
  pg_cron-invoked functions (`feed-generate`,
  `auto-cancel-unpaid-registrations`, `mux-sync-assets`, `zalo-token-refresh`).

This rules out "transient flicker": once a region's node loses the blob, it
serves NOT_FOUND_FUNCTION_BLOB **permanently** until a redeploy rewrites it.
During those 3 days, auth emails, phone OTP and payment-order creation were
hard-down for any traffic routed to us-east-1 or ap-southeast-1 — real users,
not synthetic probes.

At 29/07 ~07:00 UTC we redeployed the fleet once and verified all 6 regions
clean again — consistent with everything reported so far: a redeploy is the
only thing that restores a poisoned region.

## Asks

1. Status of the escalation to the edge-runtime team? The 26/07 report plus
   this 3-day no-deploy window should pinpoint the blob re-fetch path.
2. We've had to resume the redeploy-as-workaround loop. Any ETA — even rough —
   would help us plan around it.
3. Is there anything else we can provide to speed up the investigation? We can:
   - reproduce on demand (deploy, let a region idle 30–60 min, probe with
     `x-region`) and hand you exact UTC timestamps + request IDs of failing
     requests while they happen;
   - **leave a poisoned region unhealed for a few hours** at a time you choose,
     so your team can inspect a broken node live instead of post-mortem — just
     tell us when;
   - enable any debug flag / extra logging on the project you'd find useful.

Thanks,
Cuong
