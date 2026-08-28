-- ============================================================================
-- REVOKE sweep — say "no grant" out loud instead of relying on image defaults.
-- ----------------------------------------------------------------------------
-- pgTAP went red on main on 2026-08-28 with 25 "no client JWT may…" assertions
-- across 9 files. Nothing in the repo changed; the CI Postgres image moved
-- 17.6.1.159 → .165 and its default privileges now hand new tables/functions
-- to anon/authenticated. The migrations that created these objects never
-- REVOKEd because the old image never granted — a green that depended on the
-- image, not on the code.
--
-- Checked against production before writing (2026-08-28): of the 25, only
-- three are real on prod — anon SELECT on shop_applications,
-- inventory_movements and legal_acceptances (RLS still filters rows, but the
-- tests, rightly, want no grant at all). The other 22 are no-ops on prod and
-- exist so the next image bump cannot re-open them.
-- ============================================================================

-- ─── Tables ─────────────────────────────────────────────────────────────────
REVOKE SELECT                 ON public.shop_applications        FROM anon;
REVOKE INSERT, UPDATE         ON public.shop_media_cleanup_jobs  FROM authenticated;
REVOKE SELECT                 ON public.shop_media_cleanup_jobs  FROM anon;
REVOKE INSERT, UPDATE         ON public.shop_profile_media       FROM authenticated;
REVOKE INSERT, UPDATE         ON public.product_submission_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_movements      FROM authenticated;
REVOKE SELECT                 ON public.inventory_movements      FROM anon;
REVOKE SELECT                 ON public.product_variants         FROM anon;
REVOKE INSERT, UPDATE         ON public.legal_acceptances        FROM authenticated;
REVOKE SELECT                 ON public.legal_acceptances        FROM anon;

-- ─── Functions ──────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.ops_project_url()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_last_shipping_address()               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shop_media_cleanup_claim(integer)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_media_cleanup_complete(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.product_publish_commit(uuid, jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_media_enqueue_cleanup(text, text, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_media_reconcile()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_profile_media_publish_prepare(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shop_profile_media_publish_commit(uuid, text) FROM PUBLIC, anon, authenticated;
