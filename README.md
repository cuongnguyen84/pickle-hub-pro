# ThePickleHub

Pickleball community platform — live scores, tournaments, videos, and forum.

**Stack:** React 18 + TypeScript + Vite + shadcn-ui + Tailwind CSS + Supabase + Cloudflare Pages + Capacitor (iOS/Android)

**Production:** [thepicklehub.net](https://www.thepicklehub.net)

## Setup

```sh
git clone <repo-url>
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

```sh
npm run dev        # Dev server on port 8080
npm run build      # Production build
npm run build:dev  # Dev build with source maps
npm run lint       # ESLint check
npm run preview    # Preview production build locally
```

## Deploy

Deployed via **Cloudflare Pages** — push to `main` triggers automatic deployment.

- Frontend: Cloudflare Pages (SPA + edge functions for bot prerendering)
- Backend: Supabase (Postgres + Auth + Edge Functions)
- Custom domain: `thepicklehub.net` → `www.thepicklehub.net`

## Mobile (Capacitor)

See [MOBILE_BUILD_GUIDE.md](./MOBILE_BUILD_GUIDE.md) for iOS/Android build steps.

App ID: `net.thepicklehub.app`
