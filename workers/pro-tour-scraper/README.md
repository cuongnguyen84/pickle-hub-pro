# pro-tour-scraper

Sprint 6 — Cloudflare Worker that scrapes pro-tour bracket pages
(brackets.pickleballtournaments.com) into the Supabase pipeline.

## Bindings + secrets

```bash
# One-time secret setup (Workers Paid plan, Browser Rendering enabled)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SCRAPER_AUTH_SECRET
```

`SUPABASE_URL`, `MYBROWSER` browser binding, and the cron schedule are in
`wrangler.toml` (committed). Service-role key + scraper auth secret are
sensitive and live only in CF dashboard / wrangler secrets.

## Local dev

```bash
cd workers/pro-tour-scraper
npm install
npx wrangler dev    # local Worker, real Browser Rendering remote binding
```

Hit it manually:

```bash
BODY='{"tournament_url":"https://brackets.pickleballtournaments.com/tournaments/d7806c39-89b0-4692-970c-b73a835fa60a/events/1B71FDBD-3B56-41EF-A0D6-ADB38837896E/elimination/745D6E6E-5F00-4138-863B-B2BBB8153152","triggered_by":"manual"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SCRAPER_AUTH_SECRET" -hex | awk '{print $NF}')
curl -X POST http://localhost:8787/scrape \
  -H "Content-Type: application/json" \
  -H "X-Scraper-Signature: $SIG" \
  -d "$BODY"
```

Expected response shape:

```json
{
  "ok": true,
  "log_id": "<uuid>",
  "matches_extracted": 3,
  "players_extracted": 7
}
```

(Counts vary by tournament round depth + draw size; the values above are
from the men's doubles top-8 fixture in `__fixtures__/`.)

## Fixture harvest cycle

The parser is **not** DOM-selector based — it regex-extracts already-
structured match objects from the inline JSON that Next.js streams via
`self.__next_f.push([N, "..."])` script chunks. That makes the parser
immune to Tailwind class hash changes, dark-mode tweaks, and breakpoint
reflows. The shape we depend on is the platform's own server-side React
data contract, which can't change without breaking their UI.

Re-running the harvest cycle for a new tournament URL:

1. **Capture the post-hydration HTML.** Direct `curl` works for the
   initial server-rendered chunk (no Browser Rendering needed for parser
   verification):
   ```bash
   curl -sL -A 'Mozilla/5.0 (Macintosh)' \
     'https://brackets.pickleballtournaments.com/tournaments/<slug>/events/<UUID>/elimination/<UUID>' \
     -o /tmp/raw.html
   ```
   For full-bracket coverage the Worker's Browser Rendering path needs
   to click each round button so additional chunks stream in — that's
   orthogonal to the parser; once the chunks land in the page string,
   the same regex extractor picks them up.

2. **Save the fixture** to `workers/pro-tour-scraper/__fixtures__/<event-slug>.html`.
   These are committed (small enough — ~150KB per event). Public
   pro-player names + scores are NOT user-identifying data; do **not**
   capture admin or signed-in pages.

3. **Sanity-check the JSON shape.** A grep should find 3+ markers per
   round currently rendered:
   ```bash
   grep -c '"teams":' workers/pro-tour-scraper/__fixtures__/<file>.html
   ```
   If 0, the page didn't hydrate (auth wall, geo-block, or the platform
   changed their streaming format).

4. **Add fixture-based tests** to
   `src/lib/pro-tour/__tests__/rsc-scraper.test.ts`. Pattern: load the
   fixture file, call `parseTournamentHtml()`, assert `matches.length
   >= N`, verify spot-check player slugs + tournament name.

5. **Run vitest** from the project root until green:
   ```bash
   npx vitest run pro-tour
   ```

6. **If shape changed:** the platform may have renamed a key (e.g.
   `players` → `participants`). Update the regex constants at the top
   of `src/lib/pro-tour/adapters/rsc-scraper.ts`. The constants are
   commented with the byte sequence they're matching against — useful
   when reasoning about double-stringified JSON escape rules
   (JSON.stringify escapes `"` → `\"` but leaves `[` `]` bare).

## Deploy

```bash
cd workers/pro-tour-scraper
npx wrangler deploy
```

Deploys to `pro-tour-scraper.<account>.workers.dev`. Cron trigger
auto-registers (every 6h UTC).

## Architecture diagram

```mermaid
sequenceDiagram
  participant Admin UI
  participant Cron
  participant Worker
  participant CF Browser
  participant Edge Fn
  participant Postgres

  Admin UI->>Worker: POST /scrape (HMAC signed)
  Cron->>Worker: scheduled() every 6h
  Worker->>Postgres: SELECT pro_tour_watchlist (cron path)
  Worker->>CF Browser: launch + goto + click R32..F
  CF Browser-->>Worker: post-hydration HTML
  Worker->>Worker: parseTournamentHtml()
  Worker->>Edge Fn: POST /functions/v1/pro-tour-ingest
  Edge Fn->>Postgres: upsert profiles + matches (idempotent)
  Edge Fn-->>Worker: { log_id, matches_imported }
  Worker-->>Admin UI: { ok, log_id }
```
