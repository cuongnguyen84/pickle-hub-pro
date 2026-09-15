# Reply for SU-429781 — service-credit scope + blob issue still active

_Status: FINAL, ready to send — written 02/08 after re-querying
`function_edge_logs` (blob-404s confirmed ongoing as of 02/08 11:00 UTC)._

---

Hi,

Thanks for fixing up the metadata sync — we'll move to CLI v2.111.0 for our
deploys.

To answer your question: the service-credit request covers **both**, but the
overwhelming majority of the disruption is the **NOT_FOUND_FUNCTION_BLOB
issue**, not the recent metadata-sync incident. And to be clear: **the blob
issue is still happening right now** — it did not stop with the metadata fix.

## Disruption summary (all times UTC)

**NOT_FOUND_FUNCTION_BLOB (ongoing since ~18/07):**

- **22/07 18:45 → 23/07 00:47** — 73 of 75 edge functions returned blob-404
  for ~6 hours: auth emails, phone OTP, payment-order creation, Mux webhooks,
  OG images all hard-down.
- **24–26/07** — recurring per-region poisoning cycles (full analysis + live
  reproduction in my 26/07 reply).
- **27/07 → 29/07 06:50** — with zero deploys in that window, **us-east-1
  served blob-404 continuously for 3 days** (including `send-auth-email`,
  `phone-otp-send`, `create-payment-order`, `mux-webhook`);
  **ap-southeast-1 lost all 75 functions for ~7 hours** on 29/07;
  ap-northeast-2 lost 48 functions. Details in my 29/07 follow-up.
- **30/07 → today (02/08)** — still recurring daily, per
  `function_edge_logs` (`sb_error_code = 'NOT_FOUND_FUNCTION_BLOB'`):
  - us-east-1 has served blob-404s in nearly **every hour of every day**
    (our per-minute canary probes of 8 critical functions log ~480
    hits/hour there whenever it's poisoned — which is most of the time).
  - 01/08 10:00, 15:00, 17:00 and 02/08 01:00–04:00: us-east-1 and/or
    us-east-2 returned blob-404 for **67–77 distinct functions** in a single
    hour — that's the whole fleet, on real traffic, not just probes.
  - ap-northeast-2 — where our Vietnamese users (the bulk of our traffic)
    route — lost 40–67 distinct functions during multiple hours on each of
    31/07, 01/08 and 02/08.
  - Most recent occurrence as I write this: **02/08 10:00–11:00, us-east-1,
    44–72 distinct functions**.
- **Recovery burden:** for ~2 weeks we've had to run a Cloudflare Worker
  watchdog probing 5 regions every minute plus an automated
  redeploy-the-fleet heal loop, because a poisoned region never recovers
  without a redeploy. That's thousands of CI minutes and a standing
  maintenance burden just to keep auth/OTP/payments up.

**Metadata-sync incident (recent):** deploy failures until your fix — smaller
impact for us, but part of the same stretch of instability.

## Asks

1. Please keep the blob issue escalated with the edge-runtime team — the logs
   above show it is still active today, independent of the metadata fix.
2. For the credit review, the disruption window to consider is **18/07 →
   ongoing**, with the concrete outages listed above.
3. The offer from my 29/07 mail stands: we can leave a poisoned region
   unhealed at a time of your choosing so the team can inspect a broken node
   live — us-east-1 is reliably poisoned within 30–60 minutes of any heal.

Thanks,
Cuong
