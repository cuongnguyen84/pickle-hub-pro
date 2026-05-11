// ============================================================================
// ClubLanding (`/clb/:slug`) — public club landing page.
// ----------------------------------------------------------------------------
// Shows club identity (name, logo, location, description) + upcoming events
// + a glance at past events. Public RLS lets any viewer SELECT from clubs.
// ============================================================================

import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, Calendar, Users } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useClub, type ClubEventRow } from "@/hooks/useClub";
import { formatEventDateRange, interp } from "@/lib/social-events/format";

function EventCard({ event, lang }: { event: ClubEventRow; lang: "vi" | "en" }) {
  const title =
    lang === "vi"
      ? event.title_vi
      : (event.title_en && event.title_en.trim().length > 0 ? event.title_en : event.title_vi);
  return (
    <Card className="p-4 transition hover:shadow-md">
      <Link
        to={`/su-kien/${event.slug}`}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {event.status === "cancelled" && (
            <Badge variant="destructive">{lang === "vi" ? "Đã hủy" : "Cancelled"}</Badge>
          )}
          {event.visibility === "club_only" && (
            <Badge variant="outline">{lang === "vi" ? "Chỉ thành viên" : "Members only"}</Badge>
          )}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{title}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: "var(--tl-fg-3)" }}>
          <span><Calendar className="inline h-3.5 w-3.5" /> {formatEventDateRange(event.start_at, event.end_at, lang)}</span>
          {event.location_text && <span><MapPin className="inline h-3.5 w-3.5" /> {event.location_text}</span>}
          <span><Users className="inline h-3.5 w-3.5" /> {event.max_players}</span>
        </div>
      </Link>
    </Card>
  );
}

export default function ClubLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const { data, isLoading } = useClub(slug);

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
      <TheLineLayout title={t.socialEvents.club.notFound} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{t.socialEvents.club.notFound}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>
            {t.socialEvents.club.notFoundBody}
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

  const { club, upcoming, past } = data;
  const totalEvents = upcoming.length + past.length;

  return (
    <TheLineLayout
      title={club.name}
      description={club.description ?? `${club.name} pickleball events`}
      active="events"
    >
      <div className="tl-shell" style={{ padding: "32px 16px 60px", maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
          {club.logo_url && (
            <img
              src={club.logo_url}
              alt={club.name}
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                objectFit: "cover",
                background: "var(--tl-bg-2, rgba(0,0,0,0.04))",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 28, lineHeight: 1.2, marginBottom: 8 }}>{club.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {club.location_text && (
                <Badge variant="secondary">
                  <MapPin className="mr-1 h-3.5 w-3.5" /> {club.location_text}
                </Badge>
              )}
              <Badge variant="secondary">
                {interp(t.socialEvents.club.eventsLabel, { n: totalEvents })}
              </Badge>
            </div>
          </div>
        </div>

        {club.description && (
          <Card className="p-5 mb-6">
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{club.description}</p>
          </Card>
        )}

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
            {t.socialEvents.club.upcomingHeading}
          </h2>
          {upcoming.length === 0 ? (
            <p style={{ color: "var(--tl-fg-3)" }}>{t.socialEvents.club.noUpcoming}</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} lang={language} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              {t.socialEvents.club.pastHeading}
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {past.slice(0, 10).map((e) => (
                <EventCard key={e.id} event={e} lang={language} />
              ))}
            </div>
          </section>
        )}
      </div>
    </TheLineLayout>
  );
}
