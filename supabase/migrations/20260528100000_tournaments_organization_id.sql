-- Restore tournaments → organizations FK relationship.
--
-- Commit 41dc7ed (May 1 2026, "feat(home): tournament organizer name +
-- verified trust tick on Coming-up") added an `organization:organizations`
-- embed to useTournaments() in the client, assuming a FK on
-- tournaments.organization_id → organizations.id. The column never
-- existed, so PostgREST returns 400 PGRST200 on every
-- /rest/v1/tournaments query that uses the embed.
--
-- Symptom: useTournaments() throws → react-query data is undefined →
-- consumer fallback `allTournaments = []` kicks in → the homepage
-- "Coming-up tournaments" section and /tournaments list page have
-- been empty in production for ~27 days.
--
-- Fix: add the missing FK column. Backfill from livestreams.organization_id
-- because the production data already encodes the relationship there —
-- 8 of 10 tournaments resolve to a single distinct organizer
-- (TAPickleball) via their livestreams, 2 tournaments have no
-- livestreams yet and stay NULL. ON DELETE SET NULL so removing an
-- organization doesn't cascade-delete tournament rows.

-- 1. Add the column + FK + index.
ALTER TABLE public.tournaments
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_organization_id
  ON public.tournaments(organization_id);

-- 2. Backfill from livestreams. Group-by guarantees we only set the
--    column where the existing data points to exactly one organization;
--    in the unlikely future case of a tournament with livestreams from
--    two different orgs, the first one wins (array_agg ordering).
UPDATE public.tournaments t
SET organization_id = sub.org_id
FROM (
  SELECT
    tournament_id,
    (array_agg(DISTINCT organization_id))[1] AS org_id
  FROM public.livestreams
  WHERE tournament_id IS NOT NULL
    AND organization_id IS NOT NULL
  GROUP BY tournament_id
) sub
WHERE t.id = sub.tournament_id
  AND t.organization_id IS NULL;

-- 3. Refresh PostgREST schema cache so the embed alias starts working
--    immediately — without this NOTIFY, PostgREST keeps returning 400
--    until its periodic reload tick.
NOTIFY pgrst, 'reload schema';
