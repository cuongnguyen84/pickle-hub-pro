# ThePickleHub 🥒🏓

**The first bilingual (Vietnamese-English) pickleball platform — live scores, tournaments, court directory, player profiles, and community. Built in Vietnam, played worldwide.**

🌐 **Live:** [thepicklehub.net](https://www.thepicklehub.net) · 📱 iOS/Android via Capacitor · 👥 ~2,000 active users


## Why this exists

Pickleball is Vietnam's fastest-growing sport, but until this project, its digital infrastructure was nonexistent — tournament schedules, results, and court listings were scattered across Facebook groups with no structured, searchable home. ThePickleHub fills that gap:

- 🏆 **Tournament coverage** — schedules, brackets, and results for Vietnamese and international events (automated PPA Tour data pipeline)
- 📊 **Live scoring** — real-time match scores (SSE via Cloudflare Durable Objects, in development)
- 🎾 **Court directory** — searchable listings of pickleball courts across Vietnam with structured data (`SportsActivityLocation` JSON-LD)
- 👤 **Player profiles** — with approved DUPR API integration for global ratings
- 💬 **Community** — forum, comments with moderation, and a unified notification system
- 🌏 **Fully bilingual** — ~325 localized VI/EN strings, `/vi/*` canonical Vietnamese routing with hreflang

Built and maintained by a solo developer, pair-programming with [Claude](https://claude.com).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Cloudflare Pages (SPA)                             │
│  React 18 + TypeScript + Vite + shadcn/ui + Tailwind│
└──────────────┬──────────────────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
┌────▼─────────────┐  ┌───▼──────────────────────────┐
│ prerender-worker │  │ Supabase (Singapore)         │
│ (Cloudflare)     │  │ Postgres + Auth + 25 Edge Fns│
│ SEO for bots:    │  │ RLS, notifications, scraping │
│ JSON-LD, sitemap │  │ via Browser Rendering API    │
└──────────────────┘  └──────────────────────────────┘
```

Solutions in this repo that may help other indie devs:

- **SPA SEO without SSR** — a Cloudflare Worker that serves prerendered HTML + JSON-LD to search crawlers while keeping the SPA architecture ([`prerender-worker`](./))
- **Bilingual routing in a Vite SPA** — canonical `/vi/*` slugs, hreflang, and bilingual meta templates
- **Supabase edge function patterns** — including a workaround for the ES256/HS256 JWT verification mismatch between Supabase Auth and the edge gateway
- **Web scraping via Cloudflare Browser Rendering API** — automated sports data ingestion

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, 25 Edge Functions) |
| Edge | Cloudflare Pages + Workers (SEO prerendering) |
| Mobile | Capacitor (iOS/Android) — App ID `net.thepicklehub.app` |
| Data | DUPR API (approved), PPA Tour pipeline |

## Setup

```bash
git clone https://github.com/cuongnguyen84/pickle-hub-pro.git
cd pickle-hub-pro
npm install
```

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

## Development

```bash
npm run dev        # Dev server on port 8080
npm run build      # Production build
npm run build:dev  # Dev build with source maps
npm run lint       # ESLint check
npm run preview    # Preview production build locally
```

## Deploy

Push to `main` triggers automatic deployment via **Cloudflare Pages**.

- Frontend: Cloudflare Pages (SPA + edge functions for bot prerendering)
- Backend: Supabase (Postgres + Auth + Edge Functions)
- Domain: `thepicklehub.net` → `www.thepicklehub.net`

## Mobile (Capacitor)

See [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md) for iOS/Android build steps.

## Roadmap

- [ ] Live scoring via Durable Objects (SSE) — in progress
- [ ] Tournament auto-discovery
- [ ] DUPR rating integration on player profiles
- [ ] Expanded court directory coverage across Vietnam

## Contributing

Issues and PRs welcome — especially from the Vietnamese pickleball community. If you run a court, organize tournaments, or want a feature, [open an issue](https://github.com/cuongnguyen84/pickle-hub-pro/issues).

## License

<!-- Add a license (MIT recommended) — see note below -->
