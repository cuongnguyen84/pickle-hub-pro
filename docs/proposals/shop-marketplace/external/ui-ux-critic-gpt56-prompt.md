# Brief: UX review of a seller-onboarding + admin-review slice for a Vietnamese pickleball marketplace

You cannot see the repository. Everything you need is below.

## The product

ThePickleHub (thepicklehub.net) — a bilingual Vietnamese/English pickleball platform: tournaments, livestream, video replay, news, community feed. Solo-built by one person ("Cuong"). ~95% of users are Vietnamese. Mobile-dominant, mid-tier Android on 4G, plus a Capacitor native shell. Perf targets for the Vietnam segment at p75: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. Users typically arrive from a Facebook link straight into one deep page; they do not browse the information architecture.

Design system is called "The Line": dark editorial theme, semantic CSS tokens (`--tl-fg`, `--tl-bg`, `--tl-green`, `--tl-border`, `--tl-live`…), Inter/Geist sans body, Geist Mono uppercase 9–11px letterspaced "kicker" labels, shadcn/ui + Radix primitives, Lucide icons. No decorative gradients, no glass, no italic display headings.

## What is being proposed

A curated multi-vendor marketplace, "ThePickleHub Shop". This review covers ONLY the first slice: **seller application → admin review → shop activation**. No products, no cart, no checkout, no payments in this slice. Nothing is coded yet.

Ground truth that shapes the whole thing: **Cuong already personally knows 1–3 pickleball shops willing to try selling.** The success metric for the pilot is explicitly supply-side: *do real sellers actually put products up*. Not buyer traffic, not GMV. Zero buyers exist for this feature yet.

### Proposed seller application flow (7 steps, from the plan)

```
Authenticated user
  → Create draft
  → Step 1: Business/contact identity   (legal name, business or personal, tax code, contact phone, email)
  → Step 2: Pickup and return addresses (street, district, province/city)
  → Step 3: Bank/payout details          (bank, account number, account holder name)
  → Step 4: Upload supporting documents  (business licence and/or national ID card "CCCD", stored privately)
  → Step 5: Accept marketplace policies  (versioned, timestamped)
  → Step 6: Review and submit
  → Step 7: Admin review
      ├─ Needs changes → applicant edits and resubmits
      ├─ Rejected → reason shown
      └─ Approved → shop activated → first product → first product reviewed → selling enabled
```

Application states: `draft, submitted, under_review, needs_changes, approved, rejected, withdrawn`
Shop states: `pending_activation, active, restricted, suspended, closed`

There is no payout in this phase (COD only later, and a manual VietQR path that is explicitly NOT proof of payment). So the bank details collected at step 3 will not be used for months.

### Proposed admin review side

An admin queue at `/admin/shop/applications` and a detail page `/admin/shop/applications/:id`, with approve / reject / request-changes, each requiring a written reason, plus a private-document viewer using short-lived signed URLs, and an append-only audit log. Exactly one admin exists (Cuong). Admin routes are behind TOTP 2FA.

### Discovery / navigation constraint

The mobile bottom nav has exactly 5 slots and is full: **Home, Live, "Đi đánh" (social/play — rendered as a raised green pill, the primary CTA), Feed, Tools**. A hard constraint says: do not add a 6th slot. Proposed Shop discovery instead:
- an entry in the header burger menu (which today lists: Home, Live, Videos, News, Forum, Tools, Blog, Tournaments)
- a Shop section on the homepage
- Shop results in global search
- links from buying-guide blog articles

The homepage already has a horizontal "pulse strip" of small chips near the top: `N TRẬN ĐANG LIVE`, `N SẮP TỚI`, `N GIẢI ĐẤU`, `N NGƯỜI CHƠI`, `PPA ASIA · 2026` — each chip is a mono-uppercase label with a number and a small icon; some are links.

## Relevant facts about the existing codebase (real, verified)

1. The nearest existing moderation screen is `/admin/news`. It is a **dashboard, not a queue**: three stacked cards, every action is a single-tap toggle (`Bật`/`Tắt`, `Publish`/`Unpublish`, `Re-queue N failed`), success/failure surfaces only as a toast. There is **no detail route, no decision form, no reason field, no pagination** (hardcoded `limit(50)`), and **no error state at all** — if a query fails the list silently renders empty. Two queries poll every 15s forever. Copy is mixed English/Vietnamese and shows raw enum strings (`published`, `draft`, `failed`, `extracting`) directly to the admin.
2. The shared `Button` component: `size="default"` is 44px tall, `size="icon"` is 44×44, but `size="sm"` is **36px**. `/admin/news` uses `size="sm"` for every action including icon-only buttons.
3. There is an existing 2-step event-creation wizard with autosave-to-localStorage. It has a **hard rule**: the bank fields (bank code, account number, account holder) are deliberately **excluded from the saved draft** because a static-analysis rule flags clear-text storage of sensitive data. They must be re-entered after a restore. A reusable `useAutosaveDraft` hook exists.
4. A documented, already-observed drop-off in that same wizard: *"bank-config friction: payment fields are optional but read as required"*. This is a known real abandonment cause in this product, with these users.
5. There is **no province/district picker anywhere in the codebase**. The one existing address form (submitting a pickleball court) uses three plain text inputs: `Địa chỉ` (street), `Quận / Huyện` (district, free text), `Tỉnh / Thành phố` (city, free text, required). A canonical city list exists only for URL slugs.
6. There is **no private storage bucket and no signed-URL usage anywhere yet** — every existing bucket is public. A private KYC bucket would be the first.
7. The admin sidebar already has 18 items; the admin mobile bottom tab bar shows only 4 of them.
8. Vietnamese sellers in this market live on Shopee, TikTok Shop, and Facebook pages/groups. Facebook selling requires literally zero onboarding.

## What I want from you

Be concrete. Name the exact screen, the exact field, the exact string. No generic design advice.

1. **Is the 7-step application right-sized** for a small Vietnamese pickleball shop, given that the pilot goal is supply and Cuong already knows the 1–3 sellers personally? Which specific steps or fields would you cut, defer, or move after approval — and what is the actual friction cost of each one you keep? Where exactly does a Shopee/Facebook-native seller abandon? Is a self-serve application even the right artifact for pilot, versus something else — and if something else, what exactly?
2. **The admin review queue.** Which patterns from the `/admin/news` dashboard described above are safe to copy and which will actively break here? "Request changes" needs a back-and-forth loop between admin and applicant, unlike a news toggle. Design that loop concretely: what does the admin see, what does the seller see, how does the seller know what to fix, how many round-trips before it's a phone call instead?
3. **Vietnamese copy.** Give the actual strings a Vietnamese shop owner should see for each application state (`draft, submitted, under_review, needs_changes, approved, rejected, withdrawn`) and each shop state (`pending_activation, active, restricted, suspended, closed`). Natural Vietnamese as a shop owner would say it, not translated English. Include the status badge label AND the one-line explanation under it. Flag any Vietnamese string that will be too long for a mobile status badge.
4. **Discovery.** Given the pilot metric is *supply* (sellers listing products), not demand, is a burger-menu entry + homepage section the right investment at all? What is the minimum discovery surface that serves a supply-side pilot, and what would you build instead of the homepage Shop section?
5. **375px mobile + accessibility** for both the seller multi-step form and the admin application detail screen. Name specific layout failures you expect and the fix for each. Include empty / loading / error / offline states with their actual copy in Vietnamese and English.

Answer in English. Structure it as: blockers, strong recommendations, nits — and be willing to say a proposed thing should simply not be built.
