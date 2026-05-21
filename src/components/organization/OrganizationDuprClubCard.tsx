// ============================================================================
// OrganizationDuprClubCard — link / unlink a DUPR club on an org page (PR5)
// ----------------------------------------------------------------------------
// Drop-in card for the org management page. Shows:
//   - "Linked" view with club name, role, linked-at + Unlink button.
//   - "Not linked" view with a button that opens a dialog listing the
//     caller's eligible DUPR clubs (DIRECTOR or ORGANIZER per useDuprClubs).
//     User picks one, clicks Link, the edge fn validates + persists.
//
// All copy bilingual (VI + EN). Uses the design tokens described in
// docs/LAYOUT.md — card, ghost button, destructive variant for Unlink.
// ============================================================================

import { useState } from "react";
import { Link2, Link2Off, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { useDuprClubs } from "@/hooks/useDuprClubs";
import { useOrganizationDuprClub } from "@/hooks/useOrganizationDuprClub";

export interface OrganizationDuprClubCardProps {
  organizationId: string;
}

export function OrganizationDuprClubCard({ organizationId }: OrganizationDuprClubCardProps) {
  const { language } = useI18n();
  const {
    organization,
    loading: orgLoading,
    linked,
    link,
    linking,
    linkError,
    unlink,
    unlinking,
  } = useOrganizationDuprClub(organizationId);
  const {
    submitterClubs,
    loading: clubsLoading,
    refresh: refreshClubs,
    refreshing,
  } = useDuprClubs();
  const [open, setOpen] = useState(false);
  const [pickedClub, setPickedClub] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const T = {
    title: language === "vi" ? "Liên kết DUPR Club" : "DUPR Club Link",
    linked_subtitle:
      language === "vi"
        ? "Trận đấu thuộc tổ chức này sẽ được nộp DUPR với matchSource = CLUB."
        : "Matches in this organization are submitted to DUPR with matchSource = CLUB.",
    unlinked_subtitle:
      language === "vi"
        ? "Liên kết CLB DUPR để trận đấu được ghi nhận thuộc CLB của bạn."
        : "Link a DUPR club so matches are recognized under your club.",
    link_btn: language === "vi" ? "Liên kết DUPR Club" : "Link DUPR Club",
    unlink_btn: language === "vi" ? "Huỷ liên kết" : "Unlink",
    no_clubs:
      language === "vi"
        ? "Bạn chưa làm DIRECTOR/ORGANIZER của club DUPR nào. Yêu cầu role trên DUPR trước, sau đó refresh."
        : "You are not a DIRECTOR or ORGANIZER of any DUPR club. Request the role on DUPR first, then refresh.",
    refresh: language === "vi" ? "Làm mới danh sách" : "Refresh list",
    pick_label: language === "vi" ? "Chọn club" : "Pick a club",
    confirm: language === "vi" ? "Liên kết" : "Link",
    cancel: language === "vi" ? "Huỷ" : "Cancel",
    dialog_title: language === "vi" ? "Chọn DUPR Club" : "Pick a DUPR club",
    dialog_desc:
      language === "vi"
        ? "Chỉ club bạn là DIRECTOR hoặc ORGANIZER mới được liên kết."
        : "Only clubs where you are DIRECTOR or ORGANIZER are eligible.",
    role_label: language === "vi" ? "Vai trò" : "Role",
    linked_at_label: language === "vi" ? "Liên kết lúc" : "Linked at",
  };

  if (orgLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {T.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {T.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linked && organization?.dupr_club_id ? (
          <>
            <p className="text-sm text-muted-foreground">{T.linked_subtitle}</p>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {organization.dupr_club_name ?? `club ${organization.dupr_club_id}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: <code>{organization.dupr_club_id}</code>
                  </div>
                </div>
                {organization.dupr_club_role && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {organization.dupr_club_role}
                  </Badge>
                )}
              </div>
              {organization.dupr_linked_at && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {T.linked_at_label}:{" "}
                  {new Date(organization.dupr_linked_at).toLocaleString(
                    language === "vi" ? "vi-VN" : "en-GB",
                    { timeZone: "Asia/Ho_Chi_Minh" },
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setUnlinkError(null);
                  try {
                    await unlink();
                  } catch (e) {
                    setUnlinkError(e instanceof Error ? e.message : String(e));
                  }
                }}
                disabled={unlinking}
              >
                {unlinking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2Off className="mr-2 h-4 w-4" />
                )}
                {T.unlink_btn}
              </Button>
              {unlinkError && (
                <span className="text-xs text-destructive">{unlinkError}</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{T.unlinked_subtitle}</p>
            <Button
              onClick={() => {
                setOpen(true);
                setPickedClub(null);
              }}
              disabled={linking}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {T.link_btn}
            </Button>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{T.dialog_title}</DialogTitle>
              <DialogDescription>{T.dialog_desc}</DialogDescription>
            </DialogHeader>

            {clubsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : submitterClubs.length === 0 ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">{T.no_clubs}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshClubs()}
                  disabled={refreshing}
                >
                  {refreshing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {T.refresh}
                </Button>
              </div>
            ) : (
              <RadioGroup
                value={pickedClub ?? undefined}
                onValueChange={setPickedClub}
                className="py-3"
              >
                {submitterClubs.map((c) => (
                  <div
                    key={c.club_id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <RadioGroupItem
                      value={String(c.club_id)}
                      id={`club-${c.club_id}`}
                    />
                    <Label htmlFor={`club-${c.club_id}`} className="flex-1 cursor-pointer">
                      <div className="font-medium">
                        {c.club_name ?? `club ${c.club_id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: <code>{c.club_id}</code> · {T.role_label}: {c.role}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {linkError && (
              <p className="text-xs text-destructive">
                {linkError.message}
                {linkError.status && ` (status ${linkError.status})`}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={linking}>
                {T.cancel}
              </Button>
              <Button
                onClick={async () => {
                  if (!pickedClub) return;
                  const chosen = submitterClubs.find(
                    (c) => String(c.club_id) === pickedClub,
                  );
                  try {
                    await link({
                      dupr_club_id: pickedClub,
                      dupr_club_name: chosen?.club_name ?? null,
                    });
                    setOpen(false);
                  } catch {
                    /* linkError captured by hook */
                  }
                }}
                disabled={!pickedClub || linking}
              >
                {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {T.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default OrganizationDuprClubCard;
