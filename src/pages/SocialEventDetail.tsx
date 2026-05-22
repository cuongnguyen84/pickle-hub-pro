// ============================================================================
// SocialEventDetail (`/social/:slug`) — public landing page for one event.
// ----------------------------------------------------------------------------
// Public; renders for anonymous + authed users alike. Mobile-first card
// layout following TheLineLayout convention.
//
// Above-the-fold: title, date/time, location (Google Maps deep link), big
// CTA "Đăng ký ngay", capacity progress, countdown, fee + level badges.
// Below: description, cancellation policy, registered roster (masked
// names), Zalo CTA, share buttons.
//
// SEO: client-side JSON-LD SportsEvent injection so /social/:slug pages
// pick up rich-results coverage even without the Cloudflare prerender
// (the prerender path covers bot traffic in functions/_lib/render).
// ============================================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, Calendar, Users, Banknote, AlertTriangle, Share2, Facebook, LayoutGrid, Link as LinkIcon } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations } from "@/hooks/useEventRegistrations";
import { useMyMembership } from "@/hooks/useClubMembers";
import { RegistrationModal } from "@/components/social-events/RegistrationModal";
import { toast } from "@/hooks/use-toast";
import {
  computeCountdown,
  formatEventDateRange,
  formatLevelRange,
  formatPriceVnd,
  interp,
} from "@/lib/social-events/format";
import { maskName } from "@/lib/social-events/maskName";
import { EntityNotFound } from "@/components/EntityNotFound";
import { readMyRegistration } from "@/lib/social-events/myRegistration";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://www.thepicklehub.net";

function escapeJsonLd(s: string): string {
  return s.replace(/<\/script/gi, "<\\/script");
}

/**
 * Render a description string with `\n\n` paragraph breaks + `\n` line
 * breaks, without dangerouslySetInnerHTML. Skips empty paragraphs.
 */
function renderDescription(text: string): ReactNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return paragraphs.map((para, pi) => {
    const lines = para.split(/\n/);
    return (
      <p key={pi} style={{ margin: "0 0 12px", lineHeight: 1.6 }}>
        {lines.map((line, li) => (
          <span key={li}>
            {line}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

export default function SocialEventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const isMobile = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, refetch } = useSocialEvent(slug);
  const { data: registrations, refetch: refetchRegistrations } =
    useEventRegistrations(data?.id);

  // 2026-05-22 — when the event belongs to a CLB and the viewer is an
  // active member (or organizer of that CLB), open the modal directly
  // into the "member" step which skips OTP. Anonymous viewers + non-
  // members still see the phone flow.
  const { status: membershipStatus } = useMyMembership(data?.club_id ?? undefined);
  const memberSkipOtp =
    membershipStatus === "active" ||
    membershipStatus === "creator" ||
    membershipStatus === "manager";

  // PR58 — check localStorage for an existing registration on this
  // event. The /dang-ky/:token page is the player's only way back to
  // their registration (no SMS yet), so when we know they registered
  // we swap the big green "Register" CTA for a "View / manage" banner
  // pointing at that page. We also re-query the DB to surface the
  // current cancelled_at state so a cancelled registration shows the
  // right CTA.
  const myStored = useMemo(() => {
    if (!data?.id) return null;
    return readMyRegistration(data.id);
  }, [data?.id]);

  const { data: myStatus } = useQuery<{ cancelled_at: string | null } | null>({
    queryKey: ["my-registration-status", myStored?.magic_token ?? null],
    queryFn: async () => {
      if (!myStored?.magic_token) return null;
      const { data: row, error } = await supabase
        .rpc("get_registration_by_token", { p_magic_token: myStored.magic_token })
        .maybeSingle();
      if (error || !row) return null;
      return { cancelled_at: (row as { cancelled_at: string | null }).cancelled_at };
    },
    enabled: Boolean(myStored?.magic_token),
    staleTime: 30_000,
  });
  const isCancelled = myStatus?.cancelled_at != null;

  const eventTitle = useMemo(() => {
    if (!data) return "";
    return language === "vi"
      ? data.title_vi
      : (data.title_en && data.title_en.trim().length > 0 ? data.title_en : data.title_vi);
  }, [data, language]);

  const description = useMemo(() => {
    if (!data) return "";
    return language === "vi"
      ? (data.description_vi ?? "")
      : (data.description_en ?? data.description_vi ?? "");
  }, [data, language]);

  const countdown = useMemo(() => {
    if (!data) return null;
    return computeCountdown(data.start_at, data.end_at, language);
  }, [data, language]);

  // ─── JSON-LD injection for browser-side SEO. Bot traffic uses the
  //     Cloudflare prerender path instead. We still emit this so the
  //     page passes the Rich Results test when validated directly.
  useEffect(() => {
    if (!data) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    const url = `${SITE_URL}/social/${data.slug}`;
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: eventTitle,
      description: description.slice(0, 320) || eventTitle,
      url,
      sport: "Pickleball",
      startDate: data.start_at,
      endDate: data.end_at,
      eventStatus:
        data.status === "cancelled"
          ? "https://schema.org/EventCancelled"
          : "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      organizer: data.club
        ? {
            "@type": "SportsOrganization",
            name: data.club.name,
            url: `${SITE_URL}/clb/${data.club.slug}`,
          }
        : { "@type": "Organization", name: "ThePickleHub", url: SITE_URL },
      location: data.location_text
        ? {
            "@type": "Place",
            name: data.location_text,
            address: data.location_text,
          }
        : { "@type": "VirtualLocation", url },
      offers: {
        "@type": "Offer",
        url,
        price: data.price_vnd,
        priceCurrency: "VND",
        availability:
          (data.registered_count ?? 0) >= data.max_players
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
        validFrom: data.created_at,
      },
    };
    script.textContent = escapeJsonLd(JSON.stringify(jsonLd));
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [data, eventTitle, description]);

  if (isLoading) {
    return (
      <TheLineLayout title="Loading…" active="events">
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  if (!data) {
    return <EntityNotFound entity="event" active="events" />;
  }

  const isOrganizer = user?.id === data.created_by;
  const remaining = Math.max(0, data.max_players - (data.registered_count ?? 0));
  const eventEnded = countdown?.state === "ended" || data.status === "completed";
  const eventStarted = countdown?.state === "started";
  const cancelled = data.status === "cancelled";
  const isPreviewOnly = data.status !== "published" || data.visibility !== "public";
  // Codex Bug 3 (PR #43): block registration once the event has started.
  // phone-otp-send + phone-otp-verify both reject with
  // `event_started_or_ended` after start_at — surface that as a disabled
  // CTA instead of letting the user click through to a generic error toast.
  const canRegister =
    !eventEnded && !eventStarted && !cancelled && !isPreviewOnly && remaining > 0 && data.allow_guests;
  const eventUrl = `${SITE_URL}/social/${data.slug}`;
  const levelRange = formatLevelRange(data.level_min, data.level_max);

  // Share UX (per Sprint-1 decision): mobile gets native picker (95% VN
  // users have Zalo as a target), desktop gets explicit Zalo + Facebook
  // + Copy buttons. Detect mobile via useIsMobile rather than UA-sniff so
  // we follow the same breakpoint as the rest of the chrome.
  const handleNativeShare = async () => {
    const shareData: ShareData = {
      title: eventTitle,
      text: description.slice(0, 140) || eventTitle,
      url: eventUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    await handleCopyLink();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({ title: t.socialEvents.detail.copyLink });
    } catch {
      toast({ title: t.common.error, description: eventUrl });
    }
  };

  // Zalo share URL — opens Zalo PC client when installed, otherwise the
  // browser share UI. Encode the full event URL only; Zalo strips
  // unknown params, so we don't bother with title/text.
  const zaloShareHref = `https://zalo.me/share/url?url=${encodeURIComponent(eventUrl)}`;
  // Facebook standard sharer endpoint — opens a popup-style dialog.
  const facebookShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;

  const useNativeShare =
    isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function";

  const mapsHref = data.location_lat && data.location_lng
    ? `https://www.google.com/maps/search/?api=1&query=${data.location_lat},${data.location_lng}`
    : data.location_text
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.location_text)}`
      : null;

  return (
    <TheLineLayout
      title={eventTitle}
      description={description.slice(0, 160)}
      active="events"
      noindex={isPreviewOnly}
    >
      <div className="tl-shell" style={{ paddingBottom: 60, maxWidth: 880, margin: "0 auto" }}>
        {isPreviewOnly && isOrganizer && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              fontSize: 13,
              color: "rgba(180, 83, 9, 1)",
            }}
          >
            <AlertTriangle className="inline h-4 w-4" /> {t.socialEvents.detail.privatePreview}
          </div>
        )}

        <header className="tl-page-head">
          {data.club && (
            <div className="kicker">
              <Link
                to={`/clb/${data.club.slug}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                ◆ {t.socialEvents.detail.hostedBy} {data.club.name}
              </Link>
            </div>
          )}
          <h1>{eventTitle}</h1>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <Badge variant="secondary" className="text-sm">
            <Calendar className="mr-1 h-3.5 w-3.5" />
            {formatEventDateRange(data.start_at, data.end_at, language)}
          </Badge>
          {data.location_text && (
            <Badge variant="secondary" className="text-sm">
              <MapPin className="mr-1 h-3.5 w-3.5" />
              {data.location_text}
            </Badge>
          )}
          <Badge variant="secondary" className="text-sm">
            <Users className="mr-1 h-3.5 w-3.5" />
            {interp(t.socialEvents.detail.registeredCount, {
              registered: data.registered_count ?? 0,
              max: data.max_players,
            })}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <LayoutGrid className="mr-1 h-3.5 w-3.5" />
            {data.court_count}{" "}
            {language === "vi"
              ? "sân"
              : `court${data.court_count > 1 ? "s" : ""}`}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <Banknote className="mr-1 h-3.5 w-3.5" />
            {data.price_vnd > 0
              ? interp(t.socialEvents.detail.priceVnd, {
                  vnd: data.price_vnd.toLocaleString(language === "vi" ? "vi-VN" : "en-US"),
                })
              : t.socialEvents.detail.free}
          </Badge>
          {levelRange && (
            <Badge variant="secondary" className="text-sm">
              {t.socialEvents.detail.level} {levelRange}
            </Badge>
          )}
        </div>

        {/* Above-the-fold CTA card */}
        <Card className="p-5 mb-6">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
                {countdown?.state === "started"
                  ? t.socialEvents.detail.startedAt
                  : countdown?.state === "ended"
                    ? t.socialEvents.detail.ended
                    : t.socialEvents.detail.startsIn}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {countdown?.state === "upcoming" ? countdown.text : "—"}
              </div>
            </div>
            {/* 2026-05-20 — surface court_count next to spots-left so
                players know capacity vs. court ratio at a glance
                (e.g. 80 players / 10 courts = 8 per court). */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
                {language === "vi" ? "Số sân" : "Courts"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {data.court_count}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
                {language === "vi" ? "Chỗ còn lại" : "Spots left"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {remaining}/{data.max_players}
              </div>
            </div>
          </div>
          {/* PR58 — when localStorage says we already registered, swap
              the green primary CTA for a "View / manage" banner that
              deep-links to /dang-ky/:token. Cancelled registrations
              still need a way back so we also point at /dang-ky/:token
              (PlayerRegistration handles the reactivate flow). */}
          {myStored && !isCancelled ? (
            <a
              className="tl-btn green"
              href={`/dang-ky/${myStored.magic_token}`}
              style={{
                flex: 1,
                justifyContent: "center",
                fontSize: 15,
                padding: "14px 22px",
                textDecoration: "none",
              }}
            >
              {t.socialEvents.playerRegistration.alreadyRegisteredCta} →
            </a>
          ) : myStored && isCancelled ? (
            <a
              className="tl-btn"
              href={`/dang-ky/${myStored.magic_token}`}
              style={{
                flex: 1,
                justifyContent: "center",
                fontSize: 15,
                padding: "14px 22px",
                textDecoration: "none",
              }}
            >
              {t.socialEvents.playerRegistration.reregisterCta} →
            </a>
          ) : (
            /* TheLine vibrant-green pill primary CTA — bracket-lab pattern. */
            <button
              type="button"
              className="tl-btn green"
              style={{
                flex: 1,
                justifyContent: "center",
                fontSize: 15,
                padding: "14px 22px",
                opacity: canRegister ? 1 : 0.5,
                cursor: canRegister ? "pointer" : "not-allowed",
              }}
              disabled={!canRegister}
              onClick={() => setModalOpen(true)}
            >
              {cancelled
                ? t.socialEvents.detail.cancelled
                : eventEnded
                  ? t.socialEvents.detail.ended
                  : eventStarted
                    ? t.socialEvents.detail.registerInProgress
                    : remaining === 0
                      ? (language === "vi" ? "Hết chỗ" : "Sold out")
                      : `${t.socialEvents.detail.registerCta} →`}
            </button>
          )}
          {myStored && (
            <p className="mt-2 text-xs text-center text-muted-foreground">
              {isCancelled
                ? t.socialEvents.playerRegistration.cancelledBanner
                : t.socialEvents.playerRegistration.alreadyRegisteredBanner}
            </p>
          )}
          {/* PR59 — lost-link recovery CTA. Subtle, only relevant when
              we don't already know the viewer is registered. */}
          {!myStored && canRegister && (
            <p className="mt-2 text-xs text-center text-muted-foreground">
              {t.socialEvents.recovery.lostLinkHint}{" "}
              <Link to="/khoi-phuc-dang-ky" className="underline">
                {t.socialEvents.recovery.lostLinkCta} →
              </Link>
            </p>
          )}
          {/* TheLine inline-action share row — mono caps + arrow, no fill. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--tl-border)",
              fontFamily: "Geist Mono",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {useNativeShare ? (
              <button
                type="button"
                onClick={handleNativeShare}
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--tl-fg)" }}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Share2 className="h-3 w-3" /> {t.socialEvents.detail.shareTitle} →
              </button>
            ) : (
              <>
                <a
                  href={zaloShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.socialEvents.detail.shareZalo}
                  style={{ color: "var(--tl-fg)", textDecoration: "none" }}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: "#0068ff",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 9,
                    }}
                  >
                    Z
                  </span>
                  {t.socialEvents.detail.shareZalo} →
                </a>
                <a
                  href={facebookShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.socialEvents.detail.shareFacebook}
                  style={{ color: "var(--tl-fg)", textDecoration: "none" }}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Facebook className="h-3 w-3" /> {t.socialEvents.detail.shareFacebook} →
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label={t.socialEvents.detail.shareCopy}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--tl-fg-3)",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    textTransform: "inherit",
                    letterSpacing: "inherit",
                  }}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <LinkIcon className="h-3 w-3" /> {t.socialEvents.detail.shareCopy} →
                </button>
              </>
            )}
          </div>
        </Card>

        {description && (
          <Card className="p-5 mb-6">
            <div>{renderDescription(description)}</div>
          </Card>
        )}

        {mapsHref && (
          <Card className="p-5 mb-6">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              <MapPin className="inline h-4 w-4" /> {data.location_text}
            </h3>
            <Button asChild variant="outline" size="sm">
              <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                {t.socialEvents.detail.directionsLabel}
              </a>
            </Button>
          </Card>
        )}

        {/* Cancellation policy */}
        <Card className="p-5 mb-6">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {t.socialEvents.detail.cancellationPolicy}
          </h3>
          <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>
            {interp(t.socialEvents.detail.cancellationPolicyBody, {
              hours: data.cancellation_hours,
            })}
          </p>
        </Card>

        {/* Roster */}
        <Card className="p-5 mb-6">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            {t.socialEvents.detail.rosterHeading}
            {" · "}
            <span style={{ color: "var(--tl-fg-3)", fontWeight: 400 }}>
              {data.registered_count ?? 0}/{data.max_players}
            </span>
          </h3>
          {(registrations ?? []).length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--tl-fg-3)" }}>{t.socialEvents.detail.rosterEmpty}</p>
          ) : (
            <ol style={{ display: "grid", gap: 6, listStyle: "none", padding: 0, margin: 0, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {(registrations ?? []).map((r, i) => (
                <li
                  key={r.id}
                  style={{
                    fontSize: 14,
                    padding: "8px 10px",
                    background: "var(--tl-bg-2, rgba(0,0,0,0.03))",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{i + 1}. {maskName(r.display_name)}</span>
                  {r.self_rated_level != null && (
                    <span style={{ color: "var(--tl-fg-3)", fontSize: 12 }}>{r.self_rated_level.toFixed(1)}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {data.zalo_group_url && (
          <Button asChild variant="outline" className="w-full">
            <a href={data.zalo_group_url} target="_blank" rel="noopener noreferrer">
              {t.socialEvents.detail.zaloGroup}
            </a>
          </Button>
        )}

        <RegistrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          eventId={data.id}
          eventSlug={data.slug}
          eventTitle={eventTitle}
          priceVnd={data.price_vnd}
          requiresPrepayment={data.requires_prepayment}
          prepaymentDeadlineHours={data.prepayment_deadline_hours}
          zaloGroupUrl={data.zalo_group_url}
          slots={data.slots}
          memberSkipOtp={memberSkipOtp}
          defaultPhone={(profile as { phone?: string | null } | null)?.phone ?? null}
          defaultDisplayName={profile?.display_name ?? null}
          onSuccess={() => {
            // Codex Bug 4 (PR #43): refresh BOTH queries so the counter
            // (useSocialEvent → registered_count) and the masked roster
            // (useEventRegistrations) both reflect the new registration
            // without a manual page reload.
            refetch();
            refetchRegistrations();
          }}
        />
      </div>
    </TheLineLayout>
  );
}
