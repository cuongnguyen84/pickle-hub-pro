# Missing auth foreign-key classification — 20 November 2026

Read-only aggregate counts for23 replay-only constraints, with original CREATE
TABLE column clauses/source paths in [evidence](2026-11-20-missing-fk-aggregates.json).
No record identifiers, names, phones or application rows are returned. Each
expected constraint targets auth.users(id); original ON DELETE behavior is
retained in the source clauses, not inferred from current absence.

| Priority source | Nonnull references | Missing auth | Known ghost |
|---|---:|---:|---:|
| profiles.id |4339|958|957|
| user_roles.user_id |3384|2|0|
| quick_tables.creator_user_id |208|0|0|
| view_events.viewer_user_id |31954|33|0|

The other19 queried constraint columns have zero missing-auth references at
this observation. Zero current orphans does not establish safe future behavior,
prove deletion-action compatibility or authorize constraint installation.

Profiles cannot simply recover the original auth FK: migration
20260517000000_tournament_results_feed.sql intentionally inserts ghost profiles
with no auth user; merge_ghost_by_phone migrations also distinguish ghost vs
auth identities.957 unmatched ghost rows fit that explicit model. One unmatched
nonghost needs controlled investigation. Source search found no reviewed DROP
for these23 specific constraints; the operational origin of their removal is
unverified, even where the ghost model makes absence substantively necessary.

user_roles has two unmatched IDs and no matched ghost profiles. This is an
integrity/security review target, not permission to delete assignments or create
auth identities. Determine inactive/deleted identity provenance using authorized
private investigation, then choose a reviewed model/migration. quick_tables has
zero current orphans; review creator deletion SET NULL semantics and source
provenance before proposing a NOT VALID/VALIDATE rollout. view_events has33
unmatched references; classify deleted-user/analytics retention intent before
restoring ON DELETE SET NULL. No application data or schema was changed.
