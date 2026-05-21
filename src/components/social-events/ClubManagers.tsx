// ============================================================================
// ClubManagers — manage the "who can organize this club" list.
// ----------------------------------------------------------------------------
// Rendered inside ClubManage (organizer dashboard). Shows the creator as
// an immutable badge + a list of managers (with remove buttons), plus a
// search-by-email/phone input to add a new manager.
//
// Permission gates:
//   - Component itself rendered for any organizer (creator + manager +
//     admin) so managers can still SEE the roster of who else has access.
//   - The "Add manager" form + the per-row "Remove" button are only
//     rendered when the current viewer is the creator OR an admin
//     (`canMutate` prop). Manager viewers see a read-only list.
//
// Backed by:
//   - hooks/useClubManagers.ts (list + add + remove RPCs)
//   - search_profile_for_manager RPC (lookup by email/phone)
// ============================================================================

import { useState } from "react";
import { Loader2, UserPlus, Trash2, ShieldCheck } from "lucide-react";
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
  useClubManagers,
  type ClubManager,
  type MutationError,
  type ProfileSearchResult,
} from "@/hooks/useClubManagers";

interface Props {
  /** UUID of the club. */
  clubId: string;
  /** UUID of the club's creator — surfaced separately as an immutable badge. */
  creatorId: string;
  /** Display name for the creator (renders next to the badge). */
  creatorName: string | null;
  /** Avatar URL for the creator (optional). */
  creatorAvatarUrl: string | null;
  /**
   * Whether the current viewer can add/remove managers. Per product
   * decision, only the creator + site admins. Manager viewers get a
   * read-only list with a small "owner only" hint at the bottom.
   */
  canMutate: boolean;
}

function interp(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function translateMutationError(
  err: MutationError | null,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const m = t.socialEvents.managers;
  if (!err) return m.addError;
  switch (err.code) {
    case "already_manager":
      return m.errAlreadyManager;
    case "already_creator":
      return m.errAlreadyCreator;
    case "profile_not_found":
      return m.errProfileNotFound;
    case "not_authorized":
      return m.errNotAuthorized;
    default:
      return m.addError;
  }
}

function displayLabel(profile: ProfileSearchResult | ClubManager): string {
  const name = profile.display_name?.trim();
  if (name && name.length > 0) return name;
  if (profile.email) return profile.email;
  if (profile.phone) return profile.phone;
  return "—";
}

export function ClubManagers({
  clubId,
  creatorId,
  creatorName,
  creatorAvatarUrl,
  canMutate,
}: Props) {
  const { t, language } = useI18n();
  const m = t.socialEvents.managers;
  const { managers, isLoading, addManager, removeManager } = useClubManagers(clubId);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState<ProfileSearchResult | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ClubManager | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      toast({ title: m.searchInvalid, variant: "destructive" });
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

  async function handleAdd(profile: ProfileSearchResult) {
    try {
      await addManager.mutateAsync({ profileId: profile.profile_id });
      toast({
        title: interp(m.addSuccess, { name: displayLabel(profile) }),
      });
      // Reset search UI
      setQuery("");
      setSearched(null);
      setSearchAttempted(false);
    } catch (err) {
      const mErr = err as MutationError;
      toast({
        title: translateMutationError(mErr, t),
        variant: "destructive",
      });
    }
  }

  async function handleRemove(manager: ClubManager) {
    try {
      await removeManager.mutateAsync({ profileId: manager.profile_id });
      toast({
        title: interp(m.removeSuccess, { name: displayLabel(manager) }),
      });
    } catch (err) {
      const mErr = err as MutationError;
      toast({
        title: translateMutationError(mErr, t),
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

  // The search result is "addable" only if it's not already the creator
  // or an existing manager (UI guard; the RPC also enforces this).
  const alreadyInList =
    searched != null &&
    (searched.profile_id === creatorId ||
      managers.some((mgr) => mgr.profile_id === searched.profile_id));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {m.heading}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{m.subheading}</p>
      </div>

      {/* Creator row — immutable. Always rendered, no remove button. */}
      <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center gap-3">
        {creatorAvatarUrl ? (
          <img
            src={creatorAvatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
            {(creatorName ?? "?").trim().slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{creatorName || "—"}</div>
          <span className="tl-format-badge" style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}>
            {m.creatorBadge}
          </span>
        </div>
      </div>

      {/* Manager rows */}
      {isLoading ? (
        <div className="py-6 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : managers.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{m.empty}</p>
      ) : (
        <ul className="space-y-2">
          {managers.map((mgr) => (
            <li
              key={mgr.profile_id}
              className="rounded-md border border-border p-3 flex items-center gap-3"
            >
              {mgr.avatar_url ? (
                <img
                  src={mgr.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                  {displayLabel(mgr).trim().slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayLabel(mgr)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {mgr.email || mgr.phone || ""}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="tl-format-badge mr-2">{m.managerBadge}</span>
                  {interp(m.addedBy, { date: dateFmt.format(new Date(mgr.added_at)) })}
                </div>
              </div>
              {canMutate && (
                <button
                  type="button"
                  aria-label={m.removeAria}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
                  onClick={() => setConfirmRemove(mgr)}
                  disabled={removeManager.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add manager — creator/admin only */}
      {canMutate ? (
        <form
          className="space-y-2 rounded-md border border-dashed border-border p-3"
          onSubmit={handleSearch}
        >
          <Label htmlFor="manager-search">{m.addCta}</Label>
          <p className="text-xs text-muted-foreground">{m.searchLabel}</p>
          <div className="flex gap-2">
            <Input
              id="manager-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(null);
                setSearchAttempted(false);
              }}
              placeholder={m.searchPlaceholder}
              disabled={searching || addManager.isPending}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={searching || addManager.isPending || query.trim().length < 4}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : m.searchButton}
            </Button>
          </div>

          {/* Search results — empty state vs. found */}
          {searchAttempted && !searching && searched == null && (
            <p className="text-xs text-destructive">{m.searchEmpty}</p>
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
                  {searched.profile_id === creatorId
                    ? m.errAlreadyCreator
                    : m.errAlreadyManager}
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAdd(searched)}
                  disabled={addManager.isPending}
                >
                  {addManager.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {m.addCta}
                </Button>
              )}
            </div>
          )}
        </form>
      ) : (
        <p className="text-xs text-muted-foreground italic">{m.ownerOnly}</p>
      )}

      {/* Remove confirm dialog */}
      <Dialog open={confirmRemove !== null} onOpenChange={(o) => !o && setConfirmRemove(null)}>
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
              disabled={removeManager.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={removeManager.isPending}
            >
              {removeManager.isPending && (
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
