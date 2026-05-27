// ============================================================================
// ClubRoster — public-facing read-only member list for /clb/:slug.
// ----------------------------------------------------------------------------
// Renders on ClubLanding for members + organizers + admins of the club.
// Non-members get an empty array back from list_club_members (gated server
// -side as of migration 20260527110000), so this component decides whether
// to render a roster grid or a "members only" CTA based on the viewer's
// membership status.
//
// Visual style follows ClubMembers (organizer surface) but strips out the
// invite/approve/remove buttons — viewers here are peers, not admins. We
// also do NOT show email/phone (the RPC masks them for non-organizers).
// ============================================================================

import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useClubMembers, type ClubMember, type MyMembershipStatus } from "@/hooks/useClubMembers";

interface ClubRosterProps {
  clubId: string;
  membershipStatus: MyMembershipStatus;
}

function displayLabel(row: ClubMember): string {
  const name = row.display_name?.trim();
  if (name && name.length > 0) return name;
  return "—";
}

function initials(label: string): string {
  const cleaned = label.trim();
  if (cleaned === "—" || cleaned.length === 0) return "?";
  // Take first letter of first two words, fall back to first 2 chars.
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

export function ClubRoster({ clubId, membershipStatus }: ClubRosterProps) {
  const { t, language } = useI18n();
  const m = t.socialEvents.members;
  const canView = VIEWABLE_STATUSES.has(membershipStatus);

  // Don't even fire the query if the caller can't see anything — saves a
  // round-trip + a 0-row response on every public hit.
  const { members, isLoading } = useClubMembers(canView ? clubId : undefined);

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

  // Active members only — RPC already filters; we filter client-side too
  // in case a pending row sneaks through (organizer view).
  const active = members.filter((r) => r.status === "active");

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
          {active.length}
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{m.empty}</p>
      ) : (
        <ul
          className="grid gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {active.map((row) => {
            const label = displayLabel(row);
            return (
              <li
                key={row.profile_id}
                className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2"
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
      )}
    </Card>
  );
}
