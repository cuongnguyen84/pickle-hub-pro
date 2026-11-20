# Scoped Supabase type synchronization — 20 November 2026

Read-only generation completed with installed Supabase CLI:
supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl --schema public
Output was written to /tmp/tph-production-types.ts; no database write occurred.

Before patching, local types.ts Git blob was
bbbc06492ebf0217a878c7910dc391a46a867891, identical to the latest fetched
remote main types.ts blob. The full generated output is 13,112 lines versus
12,755 lines in the pre-patch file. It includes unrelated schema drift, such
as promo_filter_shadow and quick_table_chat_log, so wholesale replacement
was deliberately not performed.

The 29-line additive patch copies only:
- social_events.first_published_at Row/Insert/Update properties;
- quick_table_score_evidence Row/Insert/Update and one-to-one foreign key.

Both complete scoped table blocks were programmatically compared for exact
equality with production CLI output. The privilege-only secret-table migration
changes no TypeScript table shape. TypeScript compile (tsc -b --noEmit) and
git diff --check pass. Generated types describe schema shape; they do not
grant browser privileges or imply internal receipt-table API access.
