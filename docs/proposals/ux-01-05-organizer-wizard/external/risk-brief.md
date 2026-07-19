# Change under review: Organizer-wizard UX cluster (UX-01..05)

Product: ThePickleHub — bilingual (VI/EN) pickleball platform. ~2000 real users,
~95% Vietnamese. Solo-operated. Web = React 18 + Vite + Supabase (Postgres +
RLS + edge functions) on Cloudflare Pages. Native app = separate SwiftUI iOS app
(app-store review, no instant revert). Reliability outranks scope; a lost
tournament bracket slot is treated as an incident, not a rate.

## What the change proposes
Reduce abandonment of the "create" flows. FIVE distinct creation flows, all
touched in one cluster, on BOTH web and native SwiftUI simultaneously:
1. Social event wizard
2. QuickTable (casual round-robin/playoff tool)
3. TeamMatch tournament (real-money entry fees via VietQR)
4. Doubles-Elimination tournament
5. Flex tournament

Five sub-tasks:
- UX-01: creation checklist / status indicator
- UX-02: prefilled templates
- UX-03: progressive disclosure (hide advanced/payment fields until needed)
- UX-04: draft autosave (persist an in-progress creation so users can resume)
- UX-05: pre-publish validation (block publish until required fields valid)

## Concrete backend facts (verified in the repo)
- The social event flow ALREADY has a proper DB draft model:
  `social_events.status` TEXT with CHECK in ('draft','published','cancelled',
  'completed'); RLS SELECT = `(status='published' AND visibility='public') OR
  auth.uid()=created_by OR admin`. Drafts are private by construction. Good.
- The FOUR tournament flows have NO draft state today. Their status models differ:
  - `quick_tables.status`: TRUE Postgres ENUM ('setup','group_stage','playoff',
    'completed'). Also has `is_public BOOLEAN NOT NULL DEFAULT true`, and its RLS
    SELECT policy is `USING (is_public = true)` with NO status gate.
  - `team_match_tournaments.status`: TRUE Postgres ENUM ('setup','registration',
    'ongoing','completed').
  - `doubles_elimination_tournaments.status`: TEXT + CHECK constraint
    ('setup','registration_open','ongoing','completed').
  - Rows are created directly at a live/registration status today (no draft).
- Adding 'draft' to a true Postgres ENUM requires `ALTER TYPE ... ADD VALUE`,
  which is IRREVERSIBLE (Postgres cannot drop an enum value). TEXT+CHECK is
  reversible by re-altering the constraint.
- TeamMatchSetup.tsx is ~1348 lines, DoublesEliminationSetup.tsx ~1420 lines.
  These forms configure real-money payment (VietQR entry fees).
- Only the social flow is instrumented for the completion-funnel metric; the
  four tournament flows have no equivalent event, so "we increased completion"
  cannot be measured for them from the existing instrumentation.
- CI enforces a JS bundle budget: INITIAL first-paint <= 280 KB gz (now ~265),
  CODE <= 1800 KB gz (now ~1455), total backstop 1970 KB (now ~1822).
- Public sitemap for the main `tournaments` table already defensively whitelists
  status in ('ongoing','ended','upcoming'), so unknown/draft statuses are excluded.
- Native SwiftUI has all five creation screens; native ships only through
  app-store review — there is no revert button once shipped.
- There is unmerged local native creation work (19 commits on another branch)
  touching the same Swift files.

## Your job
You are a hostile staff SRE. Find the SPECIFIC failure this change causes in
production: name the mechanism, the trigger, and the user-visible symptom.
Reject generic risk language ("may impact performance"). For each finding say
which of the five sub-tasks (UX-01..05) and which of the five flows it applies
to. Rank by likelihood x blast-radius. Call out anything that is genuinely safe,
briefly. Pay special attention to:
- draft autosave (UX-04) creating orphan/rows that leak publicly or get
  swept by cleanup crons;
- the irreversible enum migration path;
- doing all five flows x two platforms in one cluster (blast radius);
- real-money payment forms behind progressive disclosure (UX-03/UX-05).
