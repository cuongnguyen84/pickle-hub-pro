// ============================================================================
// FollowOaBanner — inline CTA after successful event registration
// ----------------------------------------------------------------------------
// Shown in RegistrationModal step "success" right under the green "Đăng ký
// thành công" banner. Encourages players to follow the ThePickleHub Zalo
// Official Account so they get tournament schedules, livestream links and
// match recaps directly in Zalo.
//
// Design notes (PR65 — Zalo OA integration):
// - Inline banner, NOT a modal. The player must still be able to scroll
//   through the rest of the success view (payment ref code, save-link
//   card, share buttons).
// - Single-session dismiss via sessionStorage so it doesn't nag after the
//   first close. Resets on tab close — intentional, we want to re-prompt
//   on a fresh visit.
// - Tracks click via gtag (event: follow_oa_cta_click) so we can measure
//   conversion register → OA follower over time.
// - Uses a deep link in Zalo's universal-link format. Mobile devices will
//   open the Zalo app, desktop falls back to web.
// ============================================================================

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

const DISMISS_KEY = "follow_oa_banner_dismissed_v1";

// ThePickleHub Zalo OA URL. Default is the OA ID URL; can be overridden via
// VITE_ZALO_OA_URL env (e.g. when a custom URL like zalo.me/+thepicklehub
// is set up after upgrading the OA plan).
const DEFAULT_OA_URL = "https://zalo.me/2932845421782592643";
const ZALO_OA_URL =
  (import.meta.env.VITE_ZALO_OA_URL as string | undefined) || DEFAULT_OA_URL;

interface Props {
  /** Registration ID — passed to analytics for conversion tracking. */
  registrationId?: string;
}

export function FollowOaBanner({ registrationId }: Props) {
  const { t } = useI18n();
  const copy = t.socialEvents.playerRegistration.followOaBanner;

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // sessionStorage can throw in some private-browsing modes — ignore,
      // banner just stays visible which is the safe default.
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const handleFollow = () => {
    // Track conversion intent. Best-effort — never block the navigation.
    try {
      const w = window as unknown as {
        gtag?: (cmd: string, eventName: string, params: Record<string, unknown>) => void;
      };
      if (typeof w.gtag === "function") {
        w.gtag("event", "follow_oa_cta_click", {
          registration_id: registrationId ?? null,
          source: "registration_success_banner",
        });
      }
    } catch {
      /* ignore */
    }
    window.open(ZALO_OA_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="relative rounded-md border border-blue-300/60 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-700/40 dark:bg-blue-950/40 dark:text-blue-100"
      role="region"
      aria-label={copy.title}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={copy.dismissAriaLabel}
        className="absolute right-2 top-2 rounded p-1 text-blue-700/70 transition hover:bg-blue-100 hover:text-blue-900 dark:text-blue-300/70 dark:hover:bg-blue-900/40"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-1 text-xs text-blue-900/80 dark:text-blue-100/80">
            {copy.body}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleFollow}
          size="sm"
          className="shrink-0 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {copy.cta}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
