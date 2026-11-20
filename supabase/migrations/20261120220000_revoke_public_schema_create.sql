-- Legacy production public schema grants CREATE to PUBLIC, unlike clean replay.
-- Remove only that inherited DDL capability. Preserve USAGE and explicit
-- grants/ownership (including postgres migration-owner CREATE).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
