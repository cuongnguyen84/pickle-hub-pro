# Service Level Objectives (OPS-03)

> Defined 2026-07-16. Targets are deliberately achievable-first (solo-op,
> ~2k users); OPS-04 builds the dashboards/alerts, then we tighten. Windows
> are 30-day rolling unless noted. "Vietnam segment" = GA4/RUM
> `market_segment=vn` (bot-polluted global numbers are not SLO inputs).

| # | SLO | Target | Measured by |
|---|---|---|---|
| 1 | Web availability — `/` and `/feed` return 200 with app shell | 99.5% | Playwright smoke on deploy + external uptime check (TODO: add a 5-min pinger; smoke alone under-samples) |
| 2 | Auth — login/signup round-trip succeeds | 99% of attempts | GA4 funnel events (BASE-02) + `client_errors` auth-tagged rows |
| 3 | Registration — OTP verify → registration insert succeeds (excl. business rejections like event_full) | 99% | edge function logs: `registration_insert_failed`/`otp_lookup_failed` vs `registered` |
| 4 | Scoring — score save + bracket/next-round propagation persists | 99.5%; zero lost-update incidents | function/DB errors + DB-01/DB-02 guards; a lost bracket slot = incident, not a rate |
| 5 | Cron — every monitored schedule runs within interval+grace | 100% monitored-healthy; alert within grace | `ops_cron_monitors`/`ops_cron_alert_state` (Mux 4h+2h, DUPR 24h+2h, GitHub 7d+1d) — expand roster when new crons land |
| 6 | Latency — Vietnam mobile p75 | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 | `web_vital` RUM events (BASE-03) |
| 7 | Push — admin broadcast delivered to live tokens | ≥ 95% sent/total after prune | `send-push-notification` response metrics (sent, pruned, errors) |

## Error budget policy

Blowing an SLO for the window pauses feature work in that domain until the
burn is diagnosed (roadmap working agreement: reliability outranks scope).
Incidents get a line in `docs/ops-runbook.md` §5 if they add a new failure
class.

## Known gaps (owned by OPS-04)

- No independent uptime pinger (SLO 1 currently deploy-time only).
- SLO 2/3 need the BASE-02 funnel events to be queryable.
- No dashboard: numbers are pulled ad hoc from GA4 + SQL; OPS-04 wires
  Telegram alerts to budget burn, reusing the errors-telegram-alert path.
