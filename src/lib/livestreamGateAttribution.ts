// Livestream-gate signup attribution, kept OUT of useAuth on purpose: the
// auth surface is release-tier RED, and this is pure analytics — it must be
// revertable without touching auth code. Own listener, same semantics.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeJourney } from "@/lib/journeys";

/** Set only on a real gate-CTA click; completion fires only when present so
 * an unrelated later signup in the same tab (viewer saw the gate, left,
 * signed up from the header) is not attributed to the gate. */
const GATE_CTA_FLAG = "journey_livestream_gate_cta";

export function markGateCtaClicked() {
  try {
    sessionStorage.setItem(GATE_CTA_FLAG, "1");
  } catch {
    /* attribution is best-effort */
  }
}

// Module-level dedup mirrors useAuth's signupTrackedRef: SIGNED_IN and
// INITIAL_SESSION can both fire for one signup.
let attributed = false;

/**
 * Mount once app-wide. Completes the `livestream_gate` journey when a fresh
 * account (same <120s age heuristic as useAuth's `sign_up` event) signs in
 * with the gate-CTA flag present. Embed CTAs open a new tab with separate
 * sessionStorage, so embed completions undercount — documented in
 * docs/north-star-journeys.md.
 */
export function useLivestreamGateAttribution() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (attributed) return;
        if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
        const authUser = session?.user;
        if (!authUser?.created_at) return;
        const ageMs = Date.now() - new Date(authUser.created_at).getTime();
        if (ageMs >= 120_000) return;
        try {
          if (sessionStorage.getItem(GATE_CTA_FLAG) !== "1") return;
          sessionStorage.removeItem(GATE_CTA_FLAG);
          attributed = true;
          const method = authUser.app_metadata?.provider || "email";
          completeJourney("livestream_gate", "livestream_gate_signup_completed", {
            method,
            auth_state: "authenticated",
          });
        } catch {
          /* attribution is best-effort */
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);
}
