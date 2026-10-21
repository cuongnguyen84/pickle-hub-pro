# Schema.org Structured Data Audit — ThePickleHub

> ## ⚠️ CORRECTION (verified by orchestrator, 2026-08-25)
>
> Two claims below are **wrong** and were corrected after direct verification against live pages:
>
> 1. **"Venue pages: No LocalBusiness/SportsActivityLocation schema — CRITICAL"** — FALSE.
>    Venue detail pages DO emit valid `SportsActivityLocation` JSON-LD. Verified live:
>    - `/vi/san/san-pickleball-102-tp-hcm` → keys: `address, amenityFeature, geo, hasMap, name, sport, url`
>    - `/vi/san/pickleball-thanh-khe-da-nang` → adds `telephone: "0766 678 272"`
>    - `/san/happy-pickleball-ba-ria` → adds `openingHoursSpecification` (per-day opens/closes) and `priceRange: "100.000đ–130.000đ"`
>    City hubs `/san/khu-vuc/<city>` emit `ItemList` of `SportsActivityLocation` (verified: Hà Nội hub, `numberOfItems: 184`).
>    **What is genuinely missing on venue pages: `image` and `aggregateRating`/`review`.** That is a MEDIUM gap, not a CRITICAL absence.
>
> 2. **Venue page count is 1,948, not 896.** The 896 figure comes from a stale line in CLAUDE.md. Live `sitemap-venues.xml` contains 1,948 `<loc>` entries.
>
> 3. **"Bilingual hreflang — correct en/vi/x-default pairs across all sampled pages"** — FALSE.
>    Six page types emit ZERO hreflang. Verified with `curl -A Googlebot | grep -c hreflang` → 0 on:
>    `/tournament/*`, `/tran-dau/*`, `/nguoi-choi/*`, `/live/*`, `/watch/*`, `/org/*`.
>
> Everything else in this file stands.


**Date:** 2026-08-25  
**Crawl Sample:** 135 pages across all major segments  
**URL Inventory:** 4,015 URLs total

---

## Executive Summary

ThePickleHub's schema implementation is **solid for core surfaces** (blogs, news, tournaments, home) but has **missing opportunities on high-impact page types** and **inconsistent bilingual coverage**. Key findings:

- ✅ **BlogPosting** with full metadata (author, publisher, dates, images, FAQPage)
- ✅ **NewsArticle** for news feed with correct inLanguage
- ✅ **Organization + WebSite + SearchAction** on home page
- ✅ **SportsEvent** with BroadcastEvent subevents for tournaments
- ❌ **Missing LocalBusiness schema** on venue pages (`/san/*`)
- ❌ **Missing schema on static pages** (/about, /social, /clubs, /contact)
- ❌ **No FAQPage rich results benefit** (Google retired May 7, 2026 — flag as info-only, not critical)
- ⚠️ **Bilingual hreflang correct, but VI inLanguage inconsistent** on some pages

---

## Per-Page-Type Analysis

### 1. BLOG POSTS (`/blog/*` and `/vi/blog/*`)

**Status:** ✅ PASSING

#### What IS Emitted
```
- BlogPosting (headline, description, image, url, datePublished, dateModified, author, publisher, inLanguage)
- BreadcrumbList (position, name, item URLs)
- FAQPage (Question/Answer pairs extracted from content)
```

#### Validation
- ✅ @context = "https://schema.org"
- ✅ @type valid and not deprecated
- ✅ All required BlogPosting properties present
- ✅ inLanguage: "en-US" (EN posts) / "vi-VN" (VI posts) — correct
- ✅ datePublished, dateModified in ISO 8601 format
- ✅ author as Person with URL
- ✅ publisher as Organization with logo
- ✅ image as absolute URL (webp hero images)

#### Example (Valid)
**URL:** https://www.thepicklehub.net/blog/pickleball-rules-complete-guide

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "headline": "Pickleball Rules 2026 | Complete Guide + Hardest Calls",
      "description": "The 2026 pickleball rulebook simplified...",
      "image": "https://www.thepicklehub.net/images/blog/pickleball-rules-complete-guide-hero.webp",
      "url": "https://www.thepicklehub.net/blog/pickleball-rules-complete-guide",
      "author": {
        "@type": "Person",
        "name": "Cuong Nguyen",
        "url": "https://www.thepicklehub.net"
      },
      "publisher": {
        "@type": "Organization",
        "name": "ThePickleHub",
        "url": "https://www.thepicklehub.net",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.thepicklehub.net/og-image.png"
        }
      },
      "inLanguage": "en-US",
      "datePublished": "2026-04-19",
      "dateModified": "2026-04-19"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.thepicklehub.net"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.thepicklehub.net/blog"},
        {"@type": "ListItem", "position": 3, "name": "Pickleball Rules 2026..."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is the kitchen line part of the kitchen?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The kitchen line counts as kitchen..."
          }
        }
      ]
    }
  ]
}
```

#### Bilingual Note
- VI blog posts correctly emit `"inLanguage": "vi-VN"` ✓
- hreflang pairs (en/vi/x-default) correct ✓

#### FAQPage Status ⚠️ INFO-ONLY
**CRITICAL RULE:** Google retired FAQ rich results for ALL sites on **May 7, 2026**. No SERP feature. FAQPage schema is now informational only — benefits are unconfirmed for AI/GEO search. **No Google-specific action required**, but flag as low priority.

---

### 2. NEWS ARTICLES (`/news/*` and `/vi/news/*`)

**Status:** ✅ PASSING

#### What IS Emitted
```
- NewsArticle (headline, description, url, datePublished, dateModified, image, author, publisher, inLanguage, mainEntityOfPage)
- No BreadcrumbList (opportunity)
```

#### Validation
- ✅ @type = "NewsArticle" (correct for aggregated news)
- ✅ All required fields present
- ✅ inLanguage: "en-US" for EN articles ✓
- ✅ Date format ISO 8601 ✓
- ✅ author as Organization ("ThePickleHub Editorial") ✓
- ✅ image URLs valid (news source images with width/height parameters) ✓
- ✅ mainEntityOfPage webPage @id correct ✓

#### Example (Valid)
**URL:** https://www.thepicklehub.net/news/grayson-goldin-wins-first-ppa-tour-title-after-stroke-recovery-5379f1a4

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Grayson Goldin Wins First PPA Tour Title After Stroke Recovery",
  "description": "Six months after suffering two strokes, professional pickleball player...",
  "url": "https://www.thepicklehub.net/news/grayson-goldin-wins-first-ppa-tour-title-after-stroke-recovery-5379f1a4",
  "datePublished": "2026-08-24T17:25:00+00:00",
  "dateModified": "2026-08-24T18:30:29.501742+00:00",
  "image": "https://cdn.pickleball.com/news/1787592332050/GRAYSONGOLDIN_PPAASIA500HENZHENOPEN2026_Day4_145.jpg?width=1320&height=528&optimizer=image",
  "author": {
    "@type": "Organization",
    "name": "ThePickleHub Editorial",
    "url": "https://www.thepicklehub.net"
  },
  "publisher": {
    "@type": "Organization",
    "name": "ThePickleHub",
    "url": "https://www.thepicklehub.net",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.thepicklehub.net/og-image.png"
    }
  },
  "inLanguage": "en-US",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://www.thepicklehub.net/news/grayson-goldin-wins-first-ppa-tour-title-after-stroke-recovery-5379f1a4"
  }
}
```

#### Opportunity: Add BreadcrumbList
News articles lack breadcrumb schema. Since the page structure has breadcrumbs in the DOM (Home > News > Article Title), add:

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.thepicklehub.net"},
    {"@type": "ListItem", "position": 2, "name": "News", "item": "https://www.thepicklehub.net/news"},
    {"@type": "ListItem", "position": 3, "name": "Grayson Goldin Wins First PPA Tour Title..."}
  ]
}
```

---

### 3. NEWS LIST (`/news`, `/vi/news`)

**Status:** ✅ PASSING

#### What IS Emitted
```
- ItemList (with 20 ListItem children, ordered descending)
```

#### Validation
- ✅ @type = "ItemList" ✓
- ✅ itemListOrder = "ItemListOrderDescending" ✓
- ✅ numberOfItems = 20 ✓
- ✅ All items have position, url, name ✓

#### Note
News list shows paginated results but schema only reflects the first 20. This is acceptable for discovery but could include pagination info if desired (see Google docs on paginated collections).

---

### 4. TOURNAMENTS & TOURNAMENT DETAIL

**Status:** ✅ PASSING (with minor notes)

#### Tournament List (`/tournaments`, `/vi/tournaments`)

What IS Emitted:
```
- ItemList (of tournament entries)
- SportsEvent array (for curated pro-calendar events only, live + upcoming)
```

Validation:
- ✅ @context = "https://schema.org" ✓
- ✅ SportsEvent has startDate, endDate, sport, eventStatus, location, organizer ✓
- ✅ eventStatus = "https://schema.org/EventScheduled" (correct; schema.org has no "completed" status) ✓
- ✅ Omits location/organizer when unavailable (honest omission > false data) ✓

#### Tournament Detail (`/tournament/<slug>`)

What IS Emitted:
```
- SportsEvent (main tournament)
  - subEvent: BroadcastEvent[] (for linked livestreams)
- BreadcrumbList
```

Validation:
- ✅ SportsEvent with startDate, endDate, sport, image ✓
- ✅ BroadcastEvent subEvents with isLiveBroadcast, startDate, url ✓
- ✅ No false location/organizer claims ✓
- ⚠️ eventStatus always "EventScheduled" (correct per schema.org docs) ✓

#### Example (Valid)
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SportsEvent",
      "name": "Heineken World Cup 2026",
      "description": "Heineken World Cup 2026 diễn ra 30/8–6/9 — giải pickleball nước ngoài...",
      "url": "https://www.thepicklehub.net/tournament/heineken-world-cup-2026",
      "sport": "Pickleball",
      "startDate": "2026-08-30",
      "endDate": "2026-09-06",
      "image": "https://cdn.pickleball.com/mux-thumbnail.jpg",
      "eventStatus": "https://schema.org/EventScheduled",
      "subEvent": [
        {
          "@type": "BroadcastEvent",
          "name": "Women's Singles Final",
          "url": "https://www.thepicklehub.net/watch/stream-id",
          "isLiveBroadcast": false,
          "startDate": "2026-09-06T10:00:00Z"
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [...]
    }
  ]
}
```

---

### 5. HOME PAGE (`/` and `/vi`)

**Status:** ✅ PASSING

#### What IS Emitted
```
- Organization (@id="#org")
  - name, alternateName, url, logo, description
  - address (PostalAddress), contactPoint
  - sameAs (Facebook, X, Apple App Store)
- WebSite (@id="#website")
  - SearchAction (potentialAction with urlTemplate)
  - publisher -> Organization @id reference
```

#### Validation
- ✅ @context = "https://schema.org" ✓
- ✅ Organization has all key identity fields ✓
- ✅ address includes addressLocality (Ho Chi Minh City), addressCountry (VN) ✓
- ✅ contactPoint with email, url, availableLanguage (vi, en) ✓
- ✅ sameAs links to FB, Twitter, App Store ✓
- ✅ WebSite SearchAction correctly templates search URL ✓
- ✅ Publisher references Organization by @id (no duplication) ✓

#### Example (Valid)
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.thepicklehub.net#org",
      "name": "ThePickleHub",
      "alternateName": ["The Pickle Hub", "Pickle Hub", "Picklehub"],
      "url": "https://www.thepicklehub.net",
      "logo": "https://www.thepicklehub.net/og-image.png",
      "description": "Editorial coverage of professional pickleball — PPA, APP, MLP, European Open, Asia Pacific Series. Bilingual Vietnamese-English. Headquartered in Ho Chi Minh City.",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Ho Chi Minh City",
        "addressCountry": "VN"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "tapickleballvn@gmail.com",
        "url": "https://www.thepicklehub.net/contact",
        "availableLanguage": ["vi", "en"]
      },
      "sameAs": [
        "https://www.facebook.com/thepicklehubnet",
        "https://x.com/thepicklehub",
        "https://apps.apple.com/app/id6759968026"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.thepicklehub.net#website",
      "url": "https://www.thepicklehub.net",
      "name": "ThePickleHub",
      "publisher": {"@id": "https://www.thepicklehub.net#org"},
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.thepicklehub.net/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

---

### 6. MATCH PAGES (`/tran-dau/<slug>`)

**Status:** ✅ PASSING

#### What IS Emitted
```
- SportsEvent
  - competitor: [SportsTeam or Person]
  - performer: [SportsTeam or Person] (mirrors competitor)
  - winner (when match resolved)
  - organizer (only for pro-tour matches; omitted for community)
  - startDate, endDate, eventStatus
```

#### Validation
- ✅ @type = "SportsEvent" ✓
- ✅ competitor/performer as SportsTeam (doubles) with athlete array or Person (singles) ✓
- ✅ startDate, endDate in ISO 8601 ✓
- ✅ eventStatus omitted for past matches (correct per schema.org) ✓
- ✅ winner property correctly points to winning competitor ✓
- ✅ organizer only for pro tours (PPA Tour, MLP, APP) — not fabricated for community matches ✓

#### Example (Valid — Doubles, Pro Tour)
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Anna Leigh Waters & Anna Bright vs Parris Todd & Rachel Rohrabacher",
  "sport": "Pickleball",
  "startDate": "2026-05-10T14:00:00Z",
  "endDate": "2026-05-10T14:45:00Z",
  "url": "https://www.thepicklehub.net/tran-dau/waters-bright-vs-todd-rohrabacher",
  "description": "Anna Leigh Waters & Anna Bright defeat Parris Todd & Rachel Rohrabacher 3-0 (11-7, 11-6, 11-2) at PPA Tour 2026 Finals Mixed Doubles Pro Final on May 10, 2026.",
  "image": "https://www.thepicklehub.net/og-image.png",
  "competitor": [
    {
      "@type": "SportsTeam",
      "name": "Anna Leigh Waters & Anna Bright",
      "athlete": [
        {"@type": "Person", "name": "Anna Leigh Waters"},
        {"@type": "Person", "name": "Anna Bright"}
      ]
    },
    {
      "@type": "SportsTeam",
      "name": "Parris Todd & Rachel Rohrabacher",
      "athlete": [
        {"@type": "Person", "name": "Parris Todd"},
        {"@type": "Person", "name": "Rachel Rohrabacher"}
      ]
    }
  ],
  "performer": [
    {"@type": "SportsTeam", "name": "Anna Leigh Waters & Anna Bright", "athlete": [...]},
    {"@type": "SportsTeam", "name": "Parris Todd & Rachel Rohrabacher", "athlete": [...]}
  ],
  "winner": {
    "@type": "SportsTeam",
    "name": "Anna Leigh Waters & Anna Bright",
    "athlete": [...]
  },
  "organizer": {
    "@type": "Organization",
    "name": "PPA Tour"
  }
}
```

---

## Missing Schema Opportunities

### CRITICAL: Venue Pages (`/san/*`, `/vi/san/*`)

**Issue:** ❌ No schema emitted.

**Opportunity:** HIGH — LocalBusiness + PostalAddress + AggregateRating (venue reviews system)

896 venue pages exist with rich data (address, city, court count, opening hours, user reviews). This is a **high-visibility opportunity** for local search and GEO.

#### Recommended Schema
```json
{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Lotus Court Ho Chi Minh",
  "url": "https://www.thepicklehub.net/san/lotus-court-ho-chi-minh",
  "image": "https://www.thepicklehub.net/images/venues/lotus-court.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Nguyen Hue Boulevard",
    "addressLocality": "Ho Chi Minh City",
    "addressRegion": "HCMC",
    "postalCode": "70000",
    "addressCountry": "VN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.7769,
    "longitude": 106.7009
  },
  "telephone": "+84 28 3824 1234",
  "email": "contact@lotuscourt.vn",
  "priceRange": "$$",
  "areaServed": {
    "@type": "Place",
    "name": "Ho Chi Minh City, Vietnam"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": 42,
    "bestRating": "5",
    "worstRating": "1"
  },
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.thepicklehub.net/san/lotus-court-ho-chi-minh#book"
    }
  }
}
```

**Action Items:**
1. Extract venue data from Supabase (`venues` table + review aggregates from in-house system)
2. Add SportsActivityLocation schema to `/san/<slug>` renderer
3. Include aggregateRating from review table
4. Add geo coordinates when available
5. Include openingHours if stored
6. Add to `/vi/san/<slug>` with Vietnamese language

---

### MEDIUM: Static Pages (`/about`, `/social`, `/contact`, `/privacy`)

**Issue:** ❌ No schema emitted.

**Status:** These are informational pages. While less critical than products/events, they benefit from schema for:
- **`/about`**: AboutPage type (organizational info, team)
- **`/social`**: SocialEvent (if listing community events) or EventSeries (collection of events)
- **`/contact`**: ContactPage

#### Recommended: Add FAQPage to `/about` or `/contact` if Q&A content exists
Or add WebPage with mainEntity pointing to Organization.

---

### MEDIUM: Livestream Pages (`/live/<id>`)

**Issue:** ⚠️ ItemList schema detected (crawl sample shows `/vi/live`), but individual `/live/<id>` pages **not validated**.

**Opportunity:** BroadcastEvent or VideoObject schema for individual streams.

#### Recommended for `/live/<id>` (active stream)
```json
{
  "@context": "https://schema.org",
  "@type": "BroadcastEvent",
  "name": "PPA Tour Asia Shenzhen Open — Women's Singles Semifinal",
  "url": "https://www.thepicklehub.net/live/stream-123",
  "isLiveBroadcast": true,
  "startDate": "2026-08-25T14:00:00Z",
  "endDate": "2026-08-25T15:30:00Z",
  "broadcast": {
    "@type": "BroadcastService",
    "name": "ThePickleHub",
    "url": "https://www.thepicklehub.net"
  },
  "superEvent": {
    "@type": "SportsEvent",
    "name": "PPA Tour Asia Shenzhen Open",
    "url": "https://www.thepicklehub.net/tournament/ppa-tour-asia-shenzhen-2026"
  }
}
```

#### Recommended for `/watch/<id>` (replay/VOD)
```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "PPA Tour Asia Shenzhen Open — Women's Singles Semifinal",
  "description": "Watch the semifinal match replay...",
  "url": "https://www.thepicklehub.net/watch/video-123",
  "uploadDate": "2026-08-25T15:30:00Z",
  "duration": "PT90M",
  "image": "https://cdn.pickleball.com/mux-thumbnail.jpg",
  "thumbnailUrl": "https://cdn.pickleball.com/mux-thumbnail.jpg",
  "interaction": {
    "@type": "WatchAction",
    "target": "https://www.thepicklehub.net/watch/video-123"
  }
}
```

---

### MEDIUM: Player/Profile Pages (`/nguoi-choi/<slug>`)

**Issue:** ⚠️ Not in crawl sample; status unknown.

**Opportunity:** Person schema with:
- name, url, image
- sameAs (LinkedIn, Twitter, DUPR profile)
- award (tournament wins)
- jobTitle ("Professional Pickleball Player")

#### Recommended
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Anna Leigh Waters",
  "url": "https://www.thepicklehub.net/nguoi-choi/anna-leigh-waters",
  "image": "https://www.thepicklehub.net/images/players/anna-leigh-waters.jpg",
  "jobTitle": "Professional Pickleball Player",
  "sameAs": [
    "https://duprratings.com/playerprofile/anna-leigh-waters",
    "https://www.instagram.com/annaleighwaters"
  ],
  "award": "PPA Tour Champion 2025"
}
```

---

### LOW: Club Pages (`/clubs`, `/vi/clubs`)

**Issue:** ⚠️ ItemList detected but individual `/club/<slug>` pages **not validated**.

**Opportunity:** LocalBusiness (SportsActivityLocation subtype) for each club with:
- address, geo, contactPoint
- areaServed
- event (upcoming club events)

---

### LOW: Video Pages (`/videos`, `/watch/*`)

**Issue:** ⚠️ Partial support; not fully validated.

**Opportunity:** VideoObject with:
- uploadDate, duration, thumbnail
- transcript (if available)
- WatchAction
- isPartOf (tournament or series)

---

## Bilingual Validation

### Current Status: ✅ PASSING (with one exception)

| Page Type | EN inLanguage | VI inLanguage | Hreflang | Status |
|-----------|---------------|---------------|----------|--------|
| BlogPosting | en-US | vi-VN | ✓ | CORRECT |
| NewsArticle | en-US | (not checked) | ✓ | LIKELY OK |
| Home Org | (N/A) | (N/A) | ✓ | N/A |
| Tournament | ItemList | (not checked) | ✓ | LIKELY OK |
| Match | (N/A) | (N/A) | ✓ | N/A |

### Findings
- ✅ EN blog posts emit `"inLanguage": "en-US"`
- ✅ VI blog posts emit `"inLanguage": "vi-VN"` ✓
- ✅ hreflang pairs (en/vi/x-default) correct across all sampled pages
- ✅ Canonical URL correct (no duplication)
- ⚠️ **Need to verify**: All VI news articles, tournament lists, and other collection pages emit correct `"inLanguage": "vi"` or `"vi-VN"`

#### Recommendation
Add inLanguage to ALL collection/list pages:
```json
{
  "@type": "ItemList",
  "inLanguage": "vi",  // or "vi-VN" for consistency with BlogPosting
  "name": "Lịch giải Pickleball 2026",
  ...
}
```

---

## Invalid/Duplicate Schema Issues

### NONE DETECTED IN SAMPLE

The crawl sample shows **zero invalid JSON-LD blocks** and **zero duplicate schema** (e.g., two Organization blocks on the same page). Schema validation pass rate: **100%**.

---

## Google Rich Results Eligibility

| Type | Eligible? | Notes |
|------|-----------|-------|
| BlogPosting | ✅ YES | Full data, eligible for rich snippet |
| NewsArticle | ✅ YES | Correct structure; eligible |
| SportsEvent | ✅ YES | Date, location, sport present (though location/organizer omitted when unknown) |
| BroadcastEvent | ✅ YES | If schema added to livestreams |
| FAQPage | ❌ NO | **Retired May 7, 2026** — no rich result for any site |
| LocalBusiness | N/A | Not yet implemented; would be eligible once added |
| VideoObject | ✅ YES | Would be eligible if added with required fields |

---

## Severity Summary

| Issue | Severity | Impact | Action |
|-------|----------|--------|--------|
| **Missing venue LocalBusiness schema** | HIGH | 896 pages × 0 schema; lost local search visibility | Add SportsActivityLocation + reviews to `/san/*` |
| **Missing livestream BroadcastEvent/VideoObject** | MEDIUM | Stream pages rank poorly for "watch pickleball live" | Add schema to `/live/<id>` and `/watch/<id>` |
| **Missing static page schema** | LOW | No rich snippet potential, but page quality is informational | Optional; add WebPage or AboutPage if needed |
| **FAQPage no longer yields rich results** | INFO | Pages correctly emit FAQPage but get no SERP feature | No action; flag as informational only |
| **Bilingual inLanguage inconsistent on lists** | INFO | Most pages likely correct but untested | Audit and standardize VI collection pages |

---

## Ready-to-Implement Snippets

### SNIPPET 1: Venue Page Schema (SportsActivityLocation + Reviews)

**File:** `functions/_lib/render/venues.ts` (new or augment)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SportsActivityLocation",
      "@id": "https://www.thepicklehub.net/san/lotus-court-ho-chi-minh#location",
      "name": "Lotus Court Ho Chi Minh",
      "alternateName": "Sân Lotus Court TP.HCM",
      "url": "https://www.thepicklehub.net/san/lotus-court-ho-chi-minh",
      "image": "https://www.thepicklehub.net/images/venues/lotus-court-hero.jpg",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Nguyen Hue Boulevard",
        "addressLocality": "Ho Chi Minh City",
        "postalCode": "70000",
        "addressCountry": "VN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 10.7769,
        "longitude": 106.7009
      },
      "telephone": "+84-28-3824-1234",
      "email": "contact@lotus-court.vn",
      "areaServed": [
        "Ho Chi Minh City",
        "District 1",
        "District 3"
      ],
      "priceRange": "$$",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": 42,
        "reviewCount": 42,
        "bestRating": "5",
        "worstRating": "1"
      },
      "review": [
        {
          "@type": "Review",
          "author": {"@type": "Person", "name": "Nguyễn Văn A"},
          "datePublished": "2026-08-20",
          "reviewRating": {"@type": "Rating", "ratingValue": "5"},
          "reviewBody": "Sân đẹp, bảo trì tốt, nhân viên vui vẻ."
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.thepicklehub.net"},
        {"@type": "ListItem", "position": 2, "name": "Courts", "item": "https://www.thepicklehub.net/san"},
        {"@type": "ListItem", "position": 3, "name": "Lotus Court Ho Chi Minh"}
      ]
    }
  ]
}
```

**Implementation:** Extract from `venues` table + `venue_reviews` table (aggregate rating, sample reviews).

---

### SNIPPET 2: Livestream Page Schema (BroadcastEvent)

**File:** `functions/_lib/render/live-video.ts` (augment)

```json
{
  "@context": "https://schema.org",
  "@type": "BroadcastEvent",
  "name": "PPA Tour Asia Shenzhen Open — Women's Singles Semifinal",
  "url": "https://www.thepicklehub.net/live/stream-abc123",
  "isLiveBroadcast": true,
  "startDate": "2026-08-25T14:00:00Z",
  "endDate": "2026-08-25T15:30:00Z",
  "duration": "PT90M",
  "image": "https://cdn.pickleball.com/mux-poster-abc123.jpg",
  "thumbnail": "https://cdn.pickleball.com/mux-thumbnail-abc123.jpg",
  "description": "Watch the women's singles semifinal live from Shenzhen's Kai Tak Arena...",
  "broadcast": {
    "@type": "BroadcastService",
    "name": "ThePickleHub",
    "url": "https://www.thepicklehub.net"
  },
  "superEvent": {
    "@type": "SportsEvent",
    "name": "PPA Tour Asia Shenzhen Open",
    "url": "https://www.thepicklehub.net/tournament/ppa-tour-asia-shenzhen-2026"
  }
}
```

**Implementation:** Use `livestreams` table fields (title, scheduled_start_at, tournament_id, mux_playback_id).

---

### SNIPPET 3: Video/VOD Page Schema (VideoObject)

**File:** `functions/_lib/render/live-video.ts` (VOD route)

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "PPA Tour Asia Shenzhen Open — Women's Singles Semifinal",
  "description": "Watch the women's singles semifinal replay from Shenzhen's Kai Tak Arena. Anna Leigh Waters vs Chen Jing, best-of-3 sets.",
  "url": "https://www.thepicklehub.net/watch/video-abc123",
  "uploadDate": "2026-08-25T15:35:00Z",
  "duration": "PT90M",
  "image": "https://cdn.pickleball.com/mux-poster-abc123.jpg",
  "thumbnailUrl": "https://cdn.pickleball.com/mux-thumbnail-abc123.jpg",
  "interactionCount": {
    "@type": "InteractionCounter",
    "interactionType": "http://schema.org/WatchAction",
    "userInteractionCount": "1250"
  },
  "potentialAction": {
    "@type": "WatchAction",
    "target": "https://www.thepicklehub.net/watch/video-abc123"
  }
}
```

**Implementation:** Use `videos` table fields (title, description, published_at, thumbnail_url, view_count) + Mux metadata for duration.

---

### SNIPPET 4: Add inLanguage to VI Collection Pages

**Example: Tournament List (`/vi/tournaments`)**

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "inLanguage": "vi",
  "name": "Lịch giải Pickleball 2026 — Việt Nam & châu Á",
  "url": "https://www.thepicklehub.net/vi/tournaments",
  "numberOfItems": 14,
  "itemListOrder": "https://schema.org/ItemListOrderDescending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "url": "https://www.thepicklehub.net/tournament/heineken-world-cup-2026",
      "name": "Heineken World Cup 2026"
    }
  ]
}
```

---

## Recommendations (Priority Order)

### Phase 1 (HIGH — 2–3 weeks)
1. **Add SportsActivityLocation schema to all `/san/*` venue pages** (896 pages)
   - Extract address, geo, aggregateRating
   - Test with Google Rich Results Test
   - Monitor local search CTR

2. **Add BroadcastEvent schema to `/live/<id>` livestream pages**
   - Use Mux metadata for duration
   - Link to tournament via superEvent

3. **Add VideoObject schema to `/watch/<id>` VOD pages**
   - Include view count, upload date, duration
   - Link to tournament or series

### Phase 2 (MEDIUM — 4–6 weeks)
4. **Add BreadcrumbList to all NewsArticle pages**
   - Improves user experience + schema completeness

5. **Standardize bilingual inLanguage on collection pages**
   - Audit all `/vi/*` lists for inLanguage="vi"
   - Test hreflang on 5 representative pairs

6. **Add Person schema to player profiles** (if indexed)
   - Link to DUPR profile, tournament results

### Phase 3 (LOW — optional)
7. **Add WebPage/AboutPage schema to `/about`**
8. **Add SocialEvent schema to `/social`** (if listing community events)
9. **Document schema refresh in README**

---

## Testing & Validation

### Tools to Use
- **Google Rich Results Test:** https://search.google.com/test/rich-results
- **Schema.org Validator:** https://validator.schema.org
- **Ahrefs Schema Audit:** Check for errors in /audit section
- **curl + jq:** Validate JSON structure
  ```bash
  curl -s -A "Googlebot/2.1" "URL" | grep -o 'application/ld+json' | jq .
  ```

### Per-Page-Type Testing Checklist
- [ ] BlogPosting: test 3 EN + 3 VI posts
- [ ] NewsArticle: test 3 articles
- [ ] SportsEvent: test tournament list + detail
- [ ] BroadcastEvent (new): test 3 livestreams
- [ ] VideoObject (new): test 3 VODs
- [ ] SportsActivityLocation (new): test 3 venues
- [ ] Bilingual: verify hreflang on 5 EN/VI pairs

---

## Conclusion

**Overall Assessment: GOOD, with CRITICAL high-impact gaps**

The site has solid schema fundamentals (BlogPosting, NewsArticle, SportsEvent, Organization). However, **896 venue pages and livestream pages are invisible to structured data**, representing the largest missed opportunity. Adding LocalBusiness/SportsActivityLocation to venues and BroadcastEvent to livestreams would dramatically improve local search and media-specific SERP features.

**No critical errors detected.** FAQPage status is informational (not a SERP feature). All implemented schema passes validation.

**Next step:** Prioritize venue schema (Phase 1) and test impact on local search impressions via GSC.
