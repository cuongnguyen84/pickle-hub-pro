

# Fix OG Preview - Tach crawler va browser

## Van de

Facebook crawler follow **ca** `meta http-equiv="refresh"` lan redirect JS. Khi no redirect den SPA (`thepicklehub.net/live/:id`), SPA tra ve `index.html` voi OG tags chung -> Facebook hien thi thong tin trang chu thay vi livestream.

## Giai phap

Trong edge functions (`og-live`, `og-video`), kiem tra User-Agent cua request:

- **Neu la crawler** (Facebook, Zalo, Twitter, LinkedIn...): Tra ve HTML chi co OG tags, **KHONG** co `meta http-equiv="refresh"` va **KHONG** co JS redirect. Crawler doc OG tags va dung lai.
- **Neu la browser thuong**: Tra ve HTML co OG tags + redirect ve SPA nhu binh thuong.

### Cach phat hien crawler

```text
User-Agent chua mot trong cac tu khoa:
- facebookexternalhit
- Facebot
- Twitterbot
- LinkedInBot
- Zalobot
- Googlebot
- bingbot
- Slackbot
- WhatsApp
- Discordbot
```

## Chi tiet thay doi

### 1. `supabase/functions/og-live/index.ts`

- Them logic doc User-Agent tu request header
- Neu la crawler: bo `meta http-equiv="refresh"` va `<script>window.location.replace(...)` khoi HTML
- Neu la browser: giu nguyen redirect nhu hien tai

Thay doi chinh:
```text
// Doc User-Agent
const userAgent = req.headers.get("user-agent") || "";
const isCrawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Zalobot|WhatsApp|Discordbot|Slackbot|bingbot|Googlebot/i.test(userAgent);

// Trong HTML template:
// Chi them redirect khi KHONG phai crawler
${isCrawler ? "" : `<meta http-equiv="refresh" content="0; url=${canonicalUrl}" />`}

// Body:
${isCrawler 
  ? `<p>${ogTitle}</p>` 
  : `<p>Redirecting...</p><script>window.location.replace("${canonicalUrl}");</script>`
}
```

### 2. `supabase/functions/og-video/index.ts`

Thay doi tuong tu nhu og-live.

### 3. Deploy lai ca 2 functions

## Ket qua mong doi

- **Facebook/Zalo crawler**: Doc OG tags tu edge function, KHONG follow redirect -> hien thi dung title, description, thumbnail
- **Nguoi dung click link**: Browser thuc thi redirect -> chuyen den trang livestream/video binh thuong
- **Khong can thay doi code frontend**

## Files thay doi

| File | Thay doi |
|------|----------|
| `supabase/functions/og-live/index.ts` | Them crawler detection, conditional redirect |
| `supabase/functions/og-video/index.ts` | Them crawler detection, conditional redirect |

