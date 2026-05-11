// ============================================================================
// ClubManage (`/clb/:slug/quan-ly`) — organizer dashboard for one club.
// ----------------------------------------------------------------------------
// Lists every event in the club (drafts + published + cancelled) with
// per-event stats. CTA to create a new event. Each card links to roster +
// matchmaking + public landing.
// ============================================================================

import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2, Plus, Users, BadgeCheck, CheckCircle2, ExternalLink, Sparkles, ClipboardList } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useClub } from "@/hooks/useClub";
import { useClubEventsManage } from "@/hooks/useClubEventsManage";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { formatEventDateRange } from "@/lib/social-events/format";

export default function ClubManage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);
  const { data: events, isLoading } = useClubEventsManage(clubData?.club.id);

  const manage = t.socialEvents.manage;

  const statusBadge = useMemo(
    () => (status: string) => {
      switch (status) {
        case "draft":
          return <Badge variant="outline">{manage.statusDraft}</Badge>;
        case "published":
          return <Badge variant="default">{manage.statusPublished}</Badge>;
        case "cancelled":
          return <Badge variant="destructive">{manage.statusCancelled}</Badge>;
        case "completed":
          return <Badge variant="secondary">{manage.statusCompleted}</Badge>;
        default:
          return null;
      }
    },
    [manage],
  );

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") {
    return <Navigate to="/login" replace />;
  }
  if (permission.state === "denied") {
    return (
      <TheLineLayout title={manage.noPermissionTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{manage.noPermissionTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>
            {manage.noPermissionBody}
          </p>
        </div>
      </TheLineLayout>
    );
  }

  if (!clubData) {
    return (
      <TheLineLayout title={t.socialEvents.club.notFound} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title={`${manage.pageTitle} — ${clubData.club.name}`} active="events" noindex>
      <div className="tl-shell" style={{ padding: "32px 16px 60px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, marginBottom: 4 }}>{manage.pageTitle}</h1>
            <p style={{ color: "var(--tl-fg-3)", fontSize: 14 }}>
              <Link to={`/clb/${clubData.club.slug}`} style={{ color: "inherit" }}>
                {clubData.club.name}
              </Link>
            </p>
          </div>
          <Button asChild>
            <Link to={`/clb/${clubData.club.slug}/su-kien/moi`}>
              <Plus className="mr-2 h-4 w-4" /> {manage.newEventCta}
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (events ?? []).length === 0 && (
          <Card className="p-6 text-center" style={{ color: "var(--tl-fg-3)" }}>
            {manage.noEvents}
          </Card>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {(events ?? []).map((event) => {
            const title =
              language === "vi"
                ? event.title_vi
                : (event.title_en && event.title_en.trim().length > 0 ? event.title_en : event.title_vi);
            return (
              <Card key={event.id} className="p-4">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                      {statusBadge(event.status)}
                      {event.visibility === "club_only" && (
                        <Badge variant="outline">
                          {language === "vi" ? "Chỉ thành viên" : "Members only"}
                        </Badge>
                      )}
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
                    <p style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
                      {formatEventDateRange(event.start_at, event.end_at, language)}
                      {event.location_text ? ` · ${event.location_text}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, alignItems: "center" }}>
                    <span title={manage.statsRegistered}>
                      <Users className="inline h-3.5 w-3.5" /> {event.registered}/{event.max_players}
                    </span>
                    <span title={manage.statsPaid}>
                      <BadgeCheck className="inline h-3.5 w-3.5" /> {event.paid}
                    </span>
                    <span title={manage.statsCheckedIn}>
                      <CheckCircle2 className="inline h-3.5 w-3.5" /> {event.checked_in}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/su-kien/${event.slug}/danh-sach`}>
                      <ClipboardList className="mr-1 h-3.5 w-3.5" /> {manage.manageRoster}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/su-kien/${event.slug}/xep-cap`}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> {manage.shufflePairs}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/su-kien/${event.slug}`}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> {manage.viewPublic}
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </TheLineLayout>
  );
}
