-- ============================================================================
-- Social Events MVP — PR1 follow-up: allow re-registration after cancel
-- ============================================================================
-- Codex review Bug 1 (P1) on PR #42.
--
-- Problem: the foundation migration (20260511120000) created two partial
-- unique indexes on event_registrations that ignore the row's `status`:
--
--   uq_event_registrations_event_phone   WHERE phone IS NOT NULL
--   uq_event_registrations_event_profile WHERE profile_id IS NOT NULL
--
-- The phone-otp-send edge function intentionally allows re-registration
-- when the prior row is `cancelled` (it skips the "already registered"
-- branch in that case). But the INSERT in phone-otp-verify still trips the
-- unique constraint because the cancelled row remains visible to the
-- index. The user sees a spurious `already_registered` error.
--
-- Fix: rebuild both partial unique indexes to additionally exclude
-- status='cancelled' rows so cancelled registrations free up the slot
-- for re-registration through the OTP flow. Cancelled rows are still
-- retained for audit (organizer can see history in the roster view).
--
-- The `status` enum is enforced by the existing CHECK constraint, so the
-- index predicate is safe.
--
-- IDEMPOTENT: replay-safe (DROP IF EXISTS + CREATE UNIQUE INDEX with the
-- new predicate. CREATE UNIQUE INDEX does not support IF NOT EXISTS with
-- a WHERE clause across older Postgres versions reliably, but a DROP+CREATE
-- sequence is unconditionally safe.)
-- ============================================================================

-- ─── 1. phone uniqueness — exclude cancelled rows ───────────────────────────

DROP INDEX IF EXISTS public.uq_event_registrations_event_phone;
CREATE UNIQUE INDEX uq_event_registrations_event_phone
  ON public.event_registrations (event_id, phone)
  WHERE phone IS NOT NULL AND status <> 'cancelled';


-- ─── 2. profile_id uniqueness — same treatment ──────────────────────────────
--
-- Even though no current code path attempts a profile-based re-register,
-- keep parity with the phone index so a future authed-user re-register
-- path doesn't trip on the same bug.

DROP INDEX IF EXISTS public.uq_event_registrations_event_profile;
CREATE UNIQUE INDEX uq_event_registrations_event_profile
  ON public.event_registrations (event_id, profile_id)
  WHERE profile_id IS NOT NULL AND status <> 'cancelled';
