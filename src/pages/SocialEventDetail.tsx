// ============================================================================
// SocialEventDetail (`/su-kien/:slug`) — public landing page for one event.
// ----------------------------------------------------------------------------
// Public; renders for anonymous + authed users alike. Mobile-first card
// layout following TheLineLayout convention.
//
// Above-the-fold: title, date/time, location (Google Maps deep link), big
// CTA "Đăng ký ngay", capacity progress, countdown, fee + level badges.
// Below: description, cancellation policy, registered roster (masked
// names), Zalo CTA, share buttons.
//
// SEO: client-side JSON-LD SportsEvent injection so /su-kien/:slug pages
// pick up rich-results coverage even without the Cloudflare prerender
// (the prerender path covers bot traffic in functions/_lib/render).
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, Calendar, Users, Banknote, AlertTriangle, Share2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations } from "@/hooks/useEventRegistrations";
import { RegistrationModal } from "@/components/social-events/RegistrationModal";
import { toast } from "@/hooks/use-toast";
import {
  computeCountdown,
  formatEventDateRange,
  formatLevelRange,
  formatPriceVnd,
  interp,
} from "@/lib/social-events/format";

const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://www.thepicklehub.net";

function escapeJsonLd(s: string): string {
  return s.replace(/<\/script/gi, "<\\/script");
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length <= 2 ? parts[0] : `${parts[0][0]}***`;
  }
  const last = parts[parts.length - 1];
  const firstInitials = parts
    .slice(0, -1)
    .map((p) => `${p[0]?.toUpperCase() ?? ""}.`)
    .join(" ");
  return `${firstInitials} ${last}`.trim();
}

export default function SocialEventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, refetch } = useSocialEvent(slug);
  const { data: registrations, refetch: refetchRegistrations } =
    useEventRegistrations(data?.id);

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
    const url = `${SITE_URL}/su-kien/${data.slug}`;
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
    return (
      <TheLineLayout
        title={t.socialEvents.detail.notFound}
        active="events"
        noindex
      >
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{t.socialEvents.detail.notFound}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>
            {t.socialEvents.detail.notFoundBody}
          </p>
          <div style={{ marginTop: 24 }}>
            <Button asChild variant="outline">
              <Link to={language === "vi" ? "/vi" : "/"}>
                {language === "vi" ? "Về trang chủ" : "Back to home"}
              </Link>
            </Button>
          </div>
        </div>
      </TheLineLayout>
    );
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
  const eventUrl = `${SITE_URL}/su-kien/${data.slug}`;
  const levelRange = formatLevelRange(data.level_min, data.level_max);

  const handleShare = async () => {
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
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({ title: t.socialEvents.detail.copyLink });
    } catch {
      toast({
        title: t.common.error,
        description: eventUrl,
      });
    }
  };

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
      <div className="tl-shell" style={{ padding: "32px 16px 60px", maxWidth: 880, margin: "0 auto" }}>
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

        {data.club && (
          <Link
            to={`/clb/${data.club.slug}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--tl-fg-3)",
              marginBottom: 12,
              textDecoration: "none",
            }}
          >
            <span style={{ opacity: 0.7 }}>{t.socialEvents.detail.hostedBy}</span>
            <span style={{ color: "var(--tl-fg-1)", fontWeight: 600 }}>{data.club.name}</span>
          </Link>
        )}

        <h1 style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 16 }}>{eventTitle}</h1>

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
                {language === "vi" ? "Chỗ còn lại" : "Spots left"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {remaining}/{data.max_players}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
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
                      : t.socialEvents.detail.registerCta}
            </Button>
            <Button variant="outline" size="lg" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {t.socialEvents.detail.shareTitle}
            </Button>
          </div>
        </Card>

        {description && (
          <Card className="p-5 mb-6">
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{description}</div>
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
          <Button asChild variant="default" className="w-full">
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
          zaloGroupUrl={data.zalo_group_url}
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
