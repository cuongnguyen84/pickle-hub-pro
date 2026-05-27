// ============================================================================
// ClubRoster — public-facing read-only member list for /clb/:slug.
// ----------------------------------------------------------------------------
// Renders on ClubLanding for members + organizers + admins of the club.
// Non-members get an empty array back from list_club_members (gated server
// -side as of migration 20260527110000), so this component decides whether
// to render a roster or a "members only" CTA based on the viewer's
// membership status.
//
// The roster shows three concentric circles of belonging, in this order:
//   1. The CLB creator (clubs.created_by → profile lookup)
//   2. Managers (club_managers table, ordered by added_at ASC)
//   3. Active members (club_members where status='active')
//
// Profile IDs are de-duplicated across the three lists so a manager who is
// also in club_members only appears once. Visually we collapse to the first
// 3 names on first paint; the rest sit behind a "View all (N)" toggle to
// keep the homepage / landing page airy on mobile.
// ============================================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useClubMembers, type MyMembershipStatus } from "@/hooks/useClubMembers";
import { useClubManagers } from "@/hooks/useClubManagers";

interface ClubRosterProps {
  clubId: string;
  /** profile_id of the club creator (clubs.created_by). */
  creatorId: string;
  membershipStatus: MyMembershipStatus;
}

interface RosterEntry {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const PREVIEW_COUNT = 3;

function displayLabel(row: RosterEntry): string {
  const name = row.display_name?.trim();
  if (name && name.length > 0) return name;
  return "—";
}

function initials(label: string): string {
  const cleaned = label.trim();
  if (cleaned === "—" || cleaned.length === 0) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

const VIEWABLE_STATUSES: ReadonlySet<MyMembershipStatus> = new Set<MyMembershipStatus>([
  "active",
  "manager",
  "creator",
]);

export function ClubRoster({ clubId, creatorId, membershipStatus }: ClubRosterProps) {
  const { t, language } = useI18n();
  const m = t.socialEvents.members;
  const canView = VIEWABLE_STATUSES.has(membershipStatus);
  const [expanded, setExpanded] = useState<boolean>(false);

  // Don't fire any queries if the caller can't see anything — saves
  // round-trips + empty responses on every public hit.
  const { members, isLoading: membersLoading } = useClubMembers(canView ? clubId : undefined);
  const { managers, isLoading: managersLoading } = useClubManagers(canView ? clubId : undefined);

  // Fetch the creator's profile (display_name + avatar) by profile_id.
  // We only need a slim subset of `profiles`; RLS allows public SELECT on
  // these columns. Skip the query when the viewer can't see the roster.
  const { data: creator, isLoading: creatorLoading } = useQuery<RosterEntry | null>({
    queryKey: ["club-creator-profile", creatorId],
    enabled: Boolean(canView && creatorId),
    queryFn: async (): Promise<RosterEntry | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", creatorId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        profile_id: data.id,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
      };
    },
    staleTime: 60_000,
  });

  // Merge: creator → managers → active members; de-dupe by profile_id.
  const roster: RosterEntry[] = useMemo(() => {
    const seen = new Set<string>();
    const out: RosterEntry[] = [];

    if (creator) {
      out.push(creator);
      seen.add(creator.profile_id);
    }
    for (const mgr of managers) {
      if (!seen.has(mgr.profile_id)) {
        out.push({
          profile_id: mgr.profile_id,
          display_name: mgr.display_name,
          avatar_url: mgr.avatar_url,
        });
        seen.add(mgr.profile_id);
      }
    }
    for (const member of members) {
      if (member.status !== "active") continue;
      if (!seen.has(member.profile_id)) {
        out.push({
          profile_id: member.profile_id,
          display_name: member.display_name,
          avatar_url: member.avatar_url,
        });
        seen.add(member.profile_id);
      }
    }
    return out;
  }, [creator, managers, members]);

  // Non-members see a teaser card prompting them to join.
  if (!canView) {
    const isPending = membershipStatus === "pending";
    const teaserHeading = m.heading;
    const teaserBody = isPending
      ? language === "vi"
        ? "Yêu cầu của bạn đang chờ duyệt. Khi được chấp nhận, bạn sẽ xem được danh sách thành viên."
        : "Your join request is pending. Once approved you'll see the full member list."
      : language === "vi"
        ? "Tham gia CLB để xem danh sách thành viên."
        : "Join this club to see the member list.";
    return (
      <Card className="mb-6 p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold">{teaserHeading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{teaserBody}</p>
          </div>
        </div>
      </Card>
    );
  }

  const isLoading = membersLoading || managersLoading || creatorLoading;
  const visible = expanded ? roster : roster.slice(0, PREVIEW_COUNT);
  const hiddenCount = roster.length - PREVIEW_COUNT;

  const showAllLabel = language === "vi"
    ? `Xem tất cả (${roster.length})`
    : `View all (${roster.length})`;
  const collapseLabel = language === "vi" ? "Thu gọn" : "Show less";

  return (
    <Card className="mb-6 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {m.heading}
        </h2>
        <span
          className="text-xs uppercase tracking-wider text-muted-foreground"
          style={{
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          }}
        >
          {roster.length}
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : roster.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{m.empty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((row) => {
              const label = displayLabel(row);
              return (
                <li
                  key={row.profile_id}
                  className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
                >
                  {row.avatar_url ? (
                    <img
                      src={row.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs"
                      aria-hidden="true"
                      style={{
                        fontFamily:
                          '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                      }}
                    >
                      {initials(label)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{label}</div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Toggle — only render when there's something to hide */}
          {hiddenCount > 0 && (
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full justify-center gap-1.5 text-sm"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {collapseLabel}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {showAllLabel}
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
