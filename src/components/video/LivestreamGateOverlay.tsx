import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { startJourney, trackJourneyStep } from "@/lib/journeys";
import { markGateCtaClicked } from "@/lib/livestreamGateAttribution";
import type { GateSurface } from "@/hooks/useLivestreamGate";

interface LivestreamGateOverlayProps {
  livestreamId: string;
  surface: GateSurface;
  /** Seconds watched in this page session before the gate fired — 0 means
   * blocked on arrival (budget consumed earlier), the funnel red flag. */
  sessionSeconds?: number;
}


export function LivestreamGateOverlay({
  livestreamId,
  surface,
  sessionSeconds = 0,
}: LivestreamGateOverlayProps) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isEmbed = surface === "embed";
  const redirectPath = `/live/${livestreamId}`;

  const signupHref = `/login?mode=signup&redirect=${encodeURIComponent(redirectPath)}${isEmbed ? "&source=embed_live_gate" : ""}`;
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath)}${isEmbed ? "&source=embed_live_gate" : ""}`;

  // Gate shown = journey intent denominator. Mounting this overlay IS the
  // gate firing, so instrumentation lives here once for all three surfaces.
  useEffect(() => {
    startJourney("livestream_gate");
    trackJourneyStep("livestream_gate", "live_gate_shown", {
      surface,
      seconds_watched_session: sessionSeconds,
    });
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minimal focus trap between the two links — the video behind is inert.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const root = e.currentTarget;
    const focusables = root.querySelectorAll<HTMLElement>("a[href]");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="livestream-gate-heading"
      aria-live="polite"
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/[0.92]"
    >
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
        <Lock className="w-8 h-8 text-primary" aria-hidden="true" />
      </div>

      <div className="text-center space-y-2 px-6">
        <h3
          id="livestream-gate-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-white outline-none"
        >
          {isEmbed ? t.live.embedGateTitle : t.live.previewEnded}
        </h3>
        <p className="text-sm text-white/70">
          {isEmbed ? t.live.embedGateBody : t.live.signupToWatch}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-[280px] px-6">
        <Button asChild className="w-full">
          <a
            href={signupHref}
            {...(isEmbed ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={() => {
              markGateCtaClicked();
              trackJourneyStep("livestream_gate", "live_gate_signup_clicked", { surface });
            }}
          >
            {t.live.createAccount}
          </a>
        </Button>
        <a
          href={loginHref}
          {...(isEmbed ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={() => {
            markGateCtaClicked();
            trackJourneyStep("livestream_gate", "live_gate_login_clicked", { surface });
          }}
          className="text-sm text-white/70 hover:text-white underline underline-offset-4"
        >
          {t.live.loginToWatch}
        </a>
      </div>
    </div>
  );
}
