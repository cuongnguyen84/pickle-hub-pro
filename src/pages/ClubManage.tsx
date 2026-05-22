// ============================================================================
// ClubManage (`/clb/:slug/quan-ly`) — organizer dashboard for one club.
// ----------------------------------------------------------------------------
// Lists every event in the club (drafts + published + cancelled) with
// per-event stats. CTA to create a new event. Each card links to roster +
// matchmaking + public landing.
// ============================================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2, Plus, Users, BadgeCheck, CheckCircle2, ExternalLink, Sparkles, ClipboardList, Settings, Pencil } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useClub } from "@/hooks/useClub";
import { useClubEventsManage } from "@/hooks/useClubEventsManage";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { formatEventDateRange } from "@/lib/social-events/format";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { useNoindex } from "@/hooks/useNoindex";
import { ClubManagers } from "@/components/social-events/ClubManagers";
import { ClubMembers } from "@/components/social-events/ClubMembers";
import { supabase } from "@/integrations/supabase/client";

export default function ClubManage() {
  // PR72 (SEO Phase 2A I-7): organizer dashboard — private surface.
  useNoindex();

  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);
  const { data: events, isLoading } = useClubEventsManage(clubData?.club.id);

  // Fetch the creator's display name + avatar for the ClubManagers card.
  // The clubs row only carries created_by (UUID); we hit profiles
  // separately here so we don't bloat the shared useClub hook.
  const { data: creatorProfile } = useQuery<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>({
    queryKey: ["club-creator-profile", clubData?.club.created_by],
    queryFn: async () => {
      const creatorId = clubData?.club.created_by;
      if (!creatorId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", creatorId)
        .maybeSingle();
      if (error || !data) return null;
      return data as { display_name: string | null; avatar_url: string | null };
    },
    enabled: Boolean(clubData?.club.created_by),
    staleTime: 5 * 60_000,
  });

  // Roles drive the canMutate gate (admin can also add managers).
  const { data: roles } = useQuery<string[]>({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  const isCreator =
    Boolean(user?.id) && Boolean(clubData) && clubData!.club.created_by === user!.id;
  const isAdmin = Boolean(roles?.includes("admin"));
  // Per product decision (2026-05-21): only the creator + admins can add
  // or remove managers. Manager viewers see a read-only list.
  const canMutateManagers = isCreator || isAdmin;

  const manage = t.socialEvents.manage;

  // PR52 follow-up: TheLine `tl-format-badge` pattern — mono caps + thin
  // outline pill matching the bracket-lab status chips ("MOST POPULAR",
  // "GROUP_STAGE"). The `published` variant gets a primary-coloured
  // border to read as the active / open-for-registration state.
  const statusBadge = useMemo(
    () => (status: string) => {
      switch (status) {
        case "draft":
          return <span className="tl-format-badge">{manage.statusDraft}</span>;
        case "published":
          return (
            <span
              className="tl-format-badge"
              style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
            >
              {manage.statusPublished}
            </span>
          );
        case "cancelled":
          return (
            <span
              className="tl-format-badge"
              style={{ borderColor: "var(--tl-live)", color: "var(--tl-live)" }}
            >
              {manage.statusCancelled}
            </span>
          );
        case "completed":
          return <span className="tl-format-badge">{manage.statusCompleted}</span>;
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
    return <Navigate to={buildLoginRedirect(window.location.pathname + window.location.search)} replace />;
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
      <div className="tl-shell" style={{ paddingBottom: 60, maxWidth: 1080, margin: "0 auto" }}>
        <header
          className="tl-page-head"
          style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <div className="kicker">
              ◆{" "}
              <Link to={`/clb/${clubData.club.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                {clubData.club.name}
              </Link>
            </div>
            <h1>{manage.pageTitle}</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignSelf: "center", flexWrap: "wrap" }}>
            <Link
              to={`/clb/${clubData.club.slug}/quan-ly/cai-dat`}
              className="tl-btn"
              style={{ textDecoration: "none" }}
              title={t.socialEvents.editClub.pageTitle}
            >
              <Settings className="h-4 w-4" /> {t.socialEvents.editClub.pageTitle}
            </Link>
            {/* TheLine vibrant-green pill primary CTA — matches the
                bracket-lab header pattern ("+ Start a Quick Table →"). */}
            <Link
              to={`/clb/${clubData.club.slug}/social/moi`}
              className="tl-btn green"
            >
              <Plus className="h-4 w-4" /> {manage.newEventCta} →
            </Link>
          </div>
        </header>

        {/* Managers section — visible to all organizers, mutation gated to
            creator + admin. Hidden until the club row loaded so we can
            seed it with the creator id + name. */}
        {clubData && (
          <Card className="mb-6 p-5">
            <ClubManagers
              clubId={clubData.club.id}
              creatorId={clubData.club.created_by}
              creatorName={creatorProfile?.display_name ?? null}
              creatorAvatarUrl={creatorProfile?.avatar_url ?? null}
              canMutate={canMutateManagers}
            />
          </Card>
        )}

        {/* Members section — visible to all organizers (creator + manager
            + admin). All mutations (invite / approve / remove) are gated
            server-side via is_club_organizer. */}
        {clubData && (
          <Card className="mb-6 p-5">
            <ClubMembers clubId={clubData.club.id} />
          </Card>
        )}

        {isLoading && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (events ?? []).length === 0 && (
          /* PR55 — empty-state hero. Hides the dense card layout and
              swaps in a large CTA so the organizer who just created the
              club lands on a single clear next-step. */
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted/30">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
              {manage.emptyHeading}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {manage.emptyBody}
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to={`/clb/${clubData.club.slug}/social/moi`}
                className="tl-btn green"
              >
                <Plus className="h-4 w-4" /> {manage.emptyCta} →
              </Link>
            </div>
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
                        <span className="tl-format-badge">
                          {language === "vi" ? "Chỉ thành viên" : "Members only"}
                        </span>
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
                {/* TheLine inline-action row — mono caps + arrow, no
                    fill, matches the bracket-lab card foot pattern. */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 18,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid var(--tl-border)",
                    fontFamily: "Geist Mono",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  <Link
                    to={`/social/${event.slug}/danh-sach`}
                    style={{ color: "var(--tl-fg)", textDecoration: "none" }}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ClipboardList className="h-3 w-3" /> {manage.manageRoster} →
                  </Link>
                  <Link
                    to={`/social/${event.slug}/xep-cap`}
                    style={{ color: "var(--tl-fg)", textDecoration: "none" }}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> {manage.shufflePairs} →
                  </Link>
                  <Link
                    to={`/clb/${clubData.club.slug}/quan-ly/social/${event.slug}/sua`}
                    style={{ color: "var(--tl-fg)", textDecoration: "none" }}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> {manage.editEvent} →
                  </Link>
                  <Link
                    to={`/social/${event.slug}`}
                    style={{ color: "var(--tl-fg-3)", textDecoration: "none" }}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> {manage.viewPublic} →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </TheLineLayout>
  );
}
