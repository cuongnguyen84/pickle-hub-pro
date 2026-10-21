# Duplicate /san pages from a re-run of the alobo venue importer

**Found:** 2026-08-25 site audit · **Severity:** medium · **Status:** fixed

## What happened

`scripts/data-fixes/import-alobo-venues.mjs` ran three times on 2026-08-24 —
07:33:06 (50 rows), 07:34:01 (40 rows), 07:51:55 (46 rows). Six venues were
created **twice**, once by an earlier run and again by the 07:51 run under a
different slug.

| retired slug (deleted) | kept slug | venue |
| --- | --- | --- |
| `lakeside-pickleball-coffe-rua-xe-da-nang` | `lakeside-pickleball-coffe-rua-xe` | Lakeside Pickleball – Coffe – Rửa xe, Đà Nẵng |
| `ob-pickleball-quang-ngai` | `ob-pickleball` | OB Pickleball, Quảng Ngãi |
| `pickleball-yen-hoa-ha-noi` | `pickleball-yen-hoa` | Pickleball Yên Hòa, Hà Nội |
| `san-pickleball-quan-doi-tp-hcm` | `san-pickleball-quan-doi` | Sân Pickleball Quân Đội, TP.HCM |
| `the-pickleball-lounge-ha-noi` | `the-pickleball-lounge` | The Pickleball Lounge, Hà Nội |
| `le-ninh-t-a` | `san-le-ninh-t-a` | Lê Ninh T.A, Hà Tĩnh |

The first five pairs were field-for-field identical apart from `id` and
`created_at`. The sixth is the same court under two names and **two different
phone numbers** — the retired row carried `0976985685`, the kept row carries
`0904551002`. The retired number is preserved in
`scripts/data-fixes/2026-08-25-duplicate-venues-deleted.json`; if the court
confirms it, it belongs on the surviving row.

## Root cause

The importer resolves the slug of a new venue in two steps:

1. a **within-batch** name collision is disambiguated by appending the city
   (`go-pickleball` → `go-pickleball-vung-tau`), because two venues can share a
   name without being the same place;
2. a slug the table **already holds** is held back — an existing venue is an
   update, never an insert.

Step 2 tested only the *final* slug, and step 1 had already rewritten it. So the
same real venue took two different paths on two runs of the same script:

```
07:33 run — "Lakeside…" appears once in the export  -> no suffix
            -> inserted as `lakeside-pickleball-coffe-rua-xe`
07:51 run — "Lakeside…" appears twice in the export -> suffixed
            -> `lakeside-pickleball-coffe-rua-xe-da-nang` is not a slug we hold,
               so the guard let it through -> SECOND COPY
```

The code comment above step 1 shows the author anticipated exactly this
("suffixing it would insert a second copy of the same court instead of skipping
it") — the guard just never checked the slug the suffix was derived from.

## Harm

Each pair was two `/san` pages with identical `<title>` and identical meta
description, both indexable and both listed in `sitemap-venues.xml`. Duplicate
near-identical URLs in a sitemap split whatever link equity the venue earns and
teach Google that `/san/*` is a low-value pattern — the bill the real 890 courts
pay later. Caught one day after the rows were created, so neither copy had been
indexed.

No foreign keys pointed at any of the six rows (`venue_reviews`, `matches`,
`open_play_sessions` all returned empty), so nothing else was lost.

## Fix

- **`resolveNewVenueSlugs()`** extracted from `main()` and made the single place
  that decides a new venue's slug. It now holds a row back when the *pre-suffix*
  slug already exists **and** the existing row is in the same city. The city
  check is what keeps "Go Pickleball" in Vũng Tàu insertable while
  `go-pickleball` in Nha Trang exists — a bare base-slug check would have
  swallowed a real court. 7 tests, including the exact 2026-08-24 shape and an
  idempotency check.
- **`restAll()`** — the existing-venue snapshot was read with `&limit=2000`,
  which PostgREST silently caps at 1000. That snapshot *is* the "already exists"
  guard, so past 1000 venues every further row would have looked new: the same
  duplicate bug, at scale. venues held 896 rows on 2026-08-25 and grows
  ~100/month. Now paged.
- **301s** for the six retired URLs (EN + VI) in `public/_redirects` and
  `functions/_middleware.ts` `RETIRED_VENUE_SLUGS`, locked together by
  `src/__tests__/redirect-parity.test.ts`.
- The six rows were deleted from `venues` after the redirects were live.

## Not duplicates — deliberately left alone

- `san-pickleball-ktx-khu-a-chi-nhanh-2` / `-chi-nhanh-4` — same building, two
  branches, different phone numbers.
- `san-pickleball-nam-long-sport` / `san-tennis-nam-long-sport` — one sports
  complex, two facilities. Whether a tennis court belongs in a pickleball
  directory is a content-policy question, not a duplicate.
- `tang-bat-ho-ha-noi` / `tang-bat-ho-ha-noi-2` — user-created in May 2026 by the
  same account, same name and address but coordinates 3.5 km apart and different
  court counts. Probably one venue entered twice, possibly two. Deleting a
  member's row on a guess is worse than leaving a thin duplicate, and the two
  render different titles (only the second has a district). Left for a human.
