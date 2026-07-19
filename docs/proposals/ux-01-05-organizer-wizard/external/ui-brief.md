# UX brief — organizer create-flow cluster (ThePickleHub)

## Product context
- ThePickleHub: bilingual Vietnamese-English pickleball platform. ~95% users Vietnamese, mobile-heavy, mid-tier Android on 4G. VI is primary language, EN secondary.
- Native app is SwiftUI (all 5 create screens already exist) + a React web app. Every change ships to BOTH web and native in the same batch.
- Primary success metric: organizer funnel completion — "creation started" → "published" (called O2→O4). Main pain: organizers fill in a create form partway, then leave and lose their data (no autosave), or get stuck at the payment-config step.

## The 5 "create" flows being reviewed
1. Social Event wizard (`/clb/:slug/social/moi`) — 2-step (details → fee/payment). Most-built. Has: a live "missing fields" warning panel, a manual "Save draft" button that writes a real DB draft row, and weekly-repeat batch creation. Only this flow has a DB `draft` status.
2. QuickTable setup — round-robin table generator. Partial multi-step.
3. TeamMatch setup — 5 steps: Basic info, Game templates, Dreambreaker, Format, Fees. (Dreambreaker is a niche tiebreaker rule that currently gets its OWN full step.)
4. Doubles Elimination setup — 3 steps: Info, Format, Team list.
5. Flex Tournament setup — single-page, simplest.

## Key facts discovered from the code
- CORRECTION to an earlier assumption: 4 of the 5 flows are ALREADY multi-step wizards. So "chunk the giant form into steps" is largely done. But the Social wizard uses one visual step language (2 tiny dots + "Bước 1/2", inside a shadcn Card) while the 3 tournament flows use a DIFFERENT one (a "◆ Bước 1/3" mono kicker + big heading + description, inside a custom surface card). Two competing wizard looks in the same product.
- Only Social Event has a database `draft` status. QuickTable/TeamMatch use Postgres enums with no draft value; DoublesElim/Flex use plain TEXT status. Tournaments create the real row immediately on submit — no draft state exists. Adding server-side drafts to the 4 tournament flows = schema migration on 4 tables + RLS + native parity.
- The payment step friction (documented drop-off cause): "payment fields are optional but read as required." Free events skip bank fields; paid events require bank code / account number / account name / optional prepayment deadline. Organizers apparently think they MUST fill bank info even for free events.
- The "missing fields" warning panel uses hardcoded inline VI/EN strings with a ⚠️ emoji and raw Tailwind palette colors (amber-50/amber-900), which violates the design system's "semantic tokens only" rule.
- VI draft vocabulary already in the app, somewhat inconsistent: "Lưu nháp" (save draft, verb), "Nháp" (draft, badge), "Bản nháp" (a draft, noun), "Đã lưu nháp" (draft saved).

## The 5 proposed tasks (roadmap UX-01..05)
- UX-01: organizer setup checklist / status model (4 days)
- UX-02: templates for the 5 most common formats (5 days)
- UX-03: progressive disclosure of advanced settings (5 days)
- UX-04: draft autosave + a visible "last saved" indicator (4 days)
- UX-05: pre-publish validation with direct recovery actions (4 days)

## Questions I want your concrete take on (name the exact element + exact fix, no platitudes)
1. Priority order of UX-01..05 to actually move O2→O4 completion for a VN organizer on a phone. Which are the 1-2 that move the metric, which are nice-to-have?
2. Autosave: silent localStorage (instant, offline-proof, no backend, but device-local) vs DB draft + "Đã lưu lúc HH:MM" (cross-device, but needs a migration on 4 tournament tables and a network round-trip on flaky 4G). Which is right for this user, and where should the "last saved" indicator sit on a 390px screen?
3. Checklist/status model (UX-01): given 4 of 5 flows already have a step indicator, what form should this take WITHOUT adding a redundant second progress UI? Where does a draft become visible/resumable — in-wizard, or on the club dashboard?
4. Progressive disclosure for a 5-step form: TeamMatch gives the niche "Dreambreaker" rule its own full step. Is per-setting-as-a-step the right model, or should advanced settings collapse inside a step? How do you avoid turning 1 long page into 8 tedious steps?
5. VI microcopy: give the canonical consistent set of draft/autosave/validation strings (nháp / lưu nháp / bản nháp / last-saved / "you have unsaved work").

Be specific and concrete. Name the exact element and the exact fix.
