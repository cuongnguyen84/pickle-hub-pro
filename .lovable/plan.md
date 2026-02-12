

# Fix DNS Conflict: Cloudflare Proxy vs Lovable Hosting

## Problem
Lovable custom domains require DNS records to point **directly** (DNS only / grey cloud) to `185.158.133.1`. When Cloudflare Proxy (orange cloud) is enabled, Cloudflare intercepts all traffic and Lovable cannot verify the domain -- causing the "DNS records not properly configured" error for the entire site.

However, Cloudflare Worker Routes **require** proxied DNS to function. This creates a fundamental conflict.

## Solution: Use a Subdomain for Share Links

Instead of proxying the main domain, create a dedicated subdomain `share.thepicklehub.net` that IS proxied through Cloudflare for the Worker, while keeping the main domain DNS-only for Lovable.

### Step 1: Fix Cloudflare DNS Records

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | 185.158.133.1 | **DNS only (grey cloud)** |
| A | `www` | 185.158.133.1 | **DNS only (grey cloud)** |
| A | `share` | 192.0.2.1 (dummy) | **Proxied (orange cloud)** |

- The `share` subdomain uses a dummy IP because all traffic will be handled by the Worker (it never reaches the origin).

### Step 2: Update Worker Route

Change Worker Route from:
```
thepicklehub.net/share/*
```
To:
```
share.thepicklehub.net/*
```

### Step 3: Update Cloudflare Worker Code

Update the Worker to handle paths without the `/share/` prefix since the subdomain itself represents the share context:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Debug endpoint
    if (path === "/" || path === "/test") {
      return new Response("Share Worker is active!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    const userAgent = request.headers.get("User-Agent") || "";
    const supabaseBase = "https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1";

    // Handle /live/:id
    const liveMatch = path.match(/^\/live\/(.+)$/);
    if (liveMatch) {
      try {
        const resp = await fetch(
          `${supabaseBase}/og-live?id=${liveMatch[1]}`,
          { headers: { "User-Agent": userAgent } }
        );
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=300"
          }
        });
      } catch (e) {
        return new Response("Error proxying to og-live", { status: 502 });
      }
    }

    // Handle /video/:id
    const videoMatch = path.match(/^\/video\/(.+)$/);
    if (videoMatch) {
      try {
        const resp = await fetch(
          `${supabaseBase}/og-video?id=${videoMatch[1]}`,
          { headers: { "User-Agent": userAgent } }
        );
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=300"
          }
        });
      } catch (e) {
        return new Response("Error proxying to og-video", { status: 502 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
```

### Step 4: Update Edge Functions (code changes in this project)

Update the `og-live` and `og-video` Edge Functions to use the new share URL format:
- Old: `https://thepicklehub.net/share/live/{id}`
- New: `https://share.thepicklehub.net/live/{id}`

The `canonicalUrl` (redirect target) stays the same: `https://thepicklehub.net/live/{id}`

Files to update:
- `supabase/functions/og-live/index.ts` -- change `ogUrl` to use `share.thepicklehub.net`
- `supabase/functions/og-video/index.ts` -- change `ogUrl` to use `share.thepicklehub.net`

### Step 5: Update ShareDialog in the app

Update the share URL generation in the frontend to use `share.thepicklehub.net/live/{id}` instead of `thepicklehub.net/share/live/{id}`.

### Step 6: Verification

1. Main site `https://thepicklehub.net` should load normally again
2. `https://share.thepicklehub.net/test` should return "Share Worker is active!"
3. `https://share.thepicklehub.net/live/{id}` should return OG HTML for crawlers and redirect browsers
4. Facebook Sharing Debugger should show correct OG metadata

## Summary

```text
Before (broken):
  thepicklehub.net (proxied) --> Cloudflare --> Lovable rejects = site down

After (fixed):
  thepicklehub.net (DNS only) --> Lovable directly = site works
  share.thepicklehub.net (proxied) --> Cloudflare Worker --> Supabase Edge Functions = OG works
```

