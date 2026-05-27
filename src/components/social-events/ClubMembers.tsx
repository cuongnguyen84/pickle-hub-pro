// ============================================================================
// ClubMembers — admin-side member roster for one CLB.
// ----------------------------------------------------------------------------
// Rendered inside ClubManage (organizer dashboard). Shows:
//   1. Pending join requests with approve / reject buttons (organizer only)
//   2. Active member list with remove button (organizer only)
//   3. "Invite member" form with email/phone search → instant-add (active)
//
// Active members are the population that gets 1-click event registration
// (skip OTP). Pending rows are surfaced ONLY to organizers — public viewers
// see active rows only via the list_club_members RPC server-side filter.
//
// Permission gates:
//   - Component itself rendered for any organizer (creator + manager + admin).
//     Hidden from non-organizer viewers in ClubManage already.
//   - Invite + approve + remove are gated through the RPCs which enforce
//     is_club_organizer server-side. The buttons just call those RPCs.
// ============================================================================

import { useMemo, useState } from "react";
import { Loader2, UserPlus, Trash2, Users, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import {
  searchProfileForManager,
  type MutationError as ManagerError,
  type ProfileSearchResult,
} from "@/hooks/useClubManagers";
import {
  useClubMembers,
  type ClubMember,
  type MutationError,
} from "@/hooks/useClubMembers";

interface Props {
  clubId: string;
}

function interp(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function displayLabel(profile: ProfileSearchResult | ClubMember): string {
  const name = profile.display_name?.trim();
  if (name && name.length > 0) return name;
  if (profile.email) return profile.email;
  if (profile.phone) return profile.phone;
  return "—";
}

/**
 * PR 20260527 — render a small inline badge showing DUPR connection
 * state for one member. Uses the 4 columns added to list_club_members
 * RPC in migration 20260527130000.
 */
function DuprStatusBadge({
  member,
  vi,
}: {
  member: Pick<ClubMember, "dupr_id" | "dupr_singles" | "dupr_doubles" | "dupr_connected_via">;
  vi: boolean;
}) {
  if (!member.dupr_id) {
    return (
      <span
        className="tl-format-badge"
        style={{ color: "var(--tl-fg-3)", borderColor: "var(--tl-border)" }}
      >
        {vi ? "Chưa kết nối DUPR" : "DUPR not connected"}
      </span>
    );
  }
  const pending = member.dupr_connected_via === "pending_reconnect";
  const rating: string[] = [];
  if (member.dupr_singles != null && Number.isFinite(member.dupr_singles)) {
    rating.push(`S ${Number(member.dupr_singles).toFixed(2)}`);
  }
  if (member.dupr_doubles != null && Number.isFinite(member.dupr_doubles)) {
    rating.push(`D ${Number(member.dupr_doubles).toFixed(2)}`);
  }
  const label = pending
    ? vi
      ? "DUPR — cần kết nối lại"
      : "DUPR — reconnect needed"
    : `DUPR ${member.dupr_id}${rating.length ? " · " + rating.join(" · ") : ""}`;
  const color = pending ? "hsl(38 92% 50%)" : "rgb(22, 163, 74)";
  return (
    <span
      className="tl-format-badge"
      style={{
        color,
        borderColor: color,
        fontFamily: "'Geist Mono', monospace",
      }}
    >
      {label}
    </span>
  );
}


function translateMutationError(
  err: MutationError | ManagerError | null,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const m = t.socialEvents.members;
  if (!err) return m.inviteError;
  switch (err.code) {
    case "already_member":
      return m.errAlreadyMember;
    case "already_pending":
      return m.errAlreadyPending;
    case "already_creator":
      return m.errAlreadyCreator;
    case "already_manager":
      return m.errAlreadyManager;
    case "profile_not_found":
      return t.socialEvents.managers.errProfileNotFound;
    case "not_authorized":
      return t.socialEvents.managers.errNotAuthorized;
    default:
      return m.inviteError;
  }
}

export function ClubMembers({ clubId }: Props) {
  const { t, language } = useI18n();
  const m = t.socialEvents.members;
  const { members, isLoading, inviteMember, approveMember, removeMember } =
    useClubMembers(clubId);

  // Split pending vs active for the two sub-sections.
  const { pending, active } = useMemo(() => {
    const p: ClubMember[] = [];
    const a: ClubMember[] = [];
    for (const row of members) {
      (row.status === "pending" ? p : a).push(row);
    }
    return { pending: p, active: a };
  }, [members]);

  // ── Invite form state ──────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState<ProfileSearchResult | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ClubMember | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      toast({
        title: t.socialEvents.managers.searchInvalid,
        variant: "destructive",
      });
      return;
    }
    setSearching(true);
    setSearchAttempted(true);
    try {
      const found = await searchProfileForManager(trimmed);
      setSearched(found);
    } finally {
      setSearching(false);
    }
  }

  async function handleInvite(profile: ProfileSearchResult) {
    try {
      await inviteMember.mutateAsync({ profileId: profile.profile_id });
      toast({ title: interp(m.inviteSuccess, { name: displayLabel(profile) }) });
      setQuery("");
      setSearched(null);
      setSearchAttempted(false);
    } catch (err) {
      toast({
        title: translateMutationError(err as MutationError, t),
        variant: "destructive",
      });
    }
  }

  async function handleApprove(row: ClubMember) {
    try {
      await approveMember.mutateAsync({ profileId: row.profile_id });
      toast({ title: interp(m.approveSuccess, { name: displayLabel(row) }) });
    } catch (err) {
      toast({
        title: translateMutationError(err as MutationError, t),
        variant: "destructive",
      });
    }
  }

  async function handleRemove(row: ClubMember) {
    try {
      await removeMember.mutateAsync({ profileId: row.profile_id });
      toast({ title: interp(m.removeSuccess, { name: displayLabel(row) }) });
    } catch (err) {
      toast({
        title: translateMutationError(err as MutationError, t),
        variant: "destructive",
      });
    } finally {
      setConfirmRemove(null);
    }
  }

  const dateFmt = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const memberIds = new Set(members.map((r) => r.profile_id));
  const alreadyInList = searched != null && memberIds.has(searched.profile_id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {m.heading}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{m.subheading}</p>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 p-3">
          <h3 className="text-sm font-semibold">
            {interp(m.pendingHeading, { n: pending.length })}
          </h3>
          <ul className="space-y-2">
            {pending.map((row) => (
              <li
                key={row.profile_id}
                className="rounded-md border border-border bg-background p-3 flex items-center gap-3"
              >
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                    {displayLabel(row).trim().slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{displayLabel(row)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.email || row.phone || ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                    <DuprStatusBadge member={row} vi={language === "vi"} />
                    <span>{dateFmt.format(new Date(row.added_at))}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApprove(row)}
                    disabled={approveMember.isPending}
                  >
                    {approveMember.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {m.approveCta}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmRemove(row)}
                    disabled={removeMember.isPending}
                  >
                    <X className="h-3.5 w-3.5" /> {m.rejectCta}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active members */}
      <div className="space-y-2">
        <h3 className="text-sm font-mono uppercase tracking-wide text-muted-foreground">
          {m.activeHeading} ({active.length})
        </h3>
        {isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{m.empty}</p>
        ) : (
          <ul className="space-y-2">
            {active.map((row) => (
              <li
                key={row.profile_id}
                className="rounded-md border border-border p-3 flex items-center gap-3"
              >
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                    {displayLabel(row).trim().slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{displayLabel(row)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.email || row.phone || ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="tl-format-badge">{m.memberBadge}</span>
                    <DuprStatusBadge member={row} vi={language === "vi"} />
                    <span>{dateFmt.format(new Date(row.added_at))}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={m.removeAria}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
                  onClick={() => setConfirmRemove(row)}
                  disabled={removeMember.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite form */}
      <form
        className="space-y-2 rounded-md border border-dashed border-border p-3"
        onSubmit={handleSearch}
      >
        <Label htmlFor="member-search">{m.inviteCta}</Label>
        <p className="text-xs text-muted-foreground">
          {t.socialEvents.managers.searchLabel}
        </p>
        <div className="flex gap-2">
          <Input
            id="member-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearched(null);
              setSearchAttempted(false);
            }}
            placeholder={t.socialEvents.managers.searchPlaceholder}
            disabled={searching || inviteMember.isPending}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={searching || inviteMember.isPending || query.trim().length < 4}
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t.socialEvents.managers.searchButton
            )}
          </Button>
        </div>

        {searchAttempted && !searching && searched == null && (
          <p className="text-xs text-destructive">
            {t.socialEvents.managers.searchEmpty}
          </p>
        )}
        {searched && (
          <div className="mt-2 rounded-md border border-border bg-background p-3 flex items-center gap-3">
            {searched.avatar_url ? (
              <img
                src={searched.avatar_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                {displayLabel(searched).trim().slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{displayLabel(searched)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {searched.email || searched.phone || ""}
              </div>
            </div>
            {alreadyInList ? (
              <span className="text-xs text-muted-foreground italic">
                {m.errAlreadyMember}
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => handleInvite(searched)}
                disabled={inviteMember.isPending}
              >
                {inviteMember.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {m.inviteCta}
              </Button>
            )}
          </div>
        )}
      </form>

      {/* Remove confirm dialog (shared for both pending reject + active remove) */}
      <Dialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.removeAria}</DialogTitle>
            <DialogDescription>
              {confirmRemove
                ? interp(m.removeConfirm, { name: displayLabel(confirmRemove) })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRemove(null)}
              disabled={removeMember.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              )}
              <Trash2 className="h-3.5 w-3.5" />
              {m.removeAria}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
