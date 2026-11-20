-- Legacy production public schema grants CREATE to PUBLIC, unlike clean replay.
-- Remove only that inherited DDL capability. Preserve USAGE and explicit
-- grants/ownership (including postgres migration-owner CREATE).
-- Preserve the already-effective service DDL capability explicitly before
-- removing its accidental PUBLIC inheritance.
GRANT CREATE ON SCHEMA public TO service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
