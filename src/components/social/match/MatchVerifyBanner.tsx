// ============================================================================
// MatchVerifyBanner — Sprint 2 Phase 3B.1
// Conditional based on match.verification_status + viewer's role:
//   pending + viewer is participant + NOT recorder → confirm/dispute CTAs
//   pending + viewer is recorder                  → "waiting" message
//   verified                                      → success
//   disputed                                      → warning
//   expired                                       → muted info
// ============================================================================

import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useMatchConfirm, useMatchDispute, type MatchDetail } from "@/hooks/social";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string | null, language: "vi" | "en") => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(language === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return iso; }
};

export const MatchVerifyBanner = ({ match }: { match: MatchDetail }) => {
  const { user } = useAuth();
  const { language } = useI18n();
  const confirm = useMatchConfirm(match.slug);
  const dispute = useMatchDispute(match.slug);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);

  const viewerParticipant = user
    ? match.participants.find((p) => p.player_id === user.id)
    : null;
  const isParticipant = !!viewerParticipant;
  const isRecorder = !!user && match.recorded_by === user.id;
  const alreadyConfirmed = !!viewerParticipant?.confirmed;
  const alreadyDisputed = !!viewerParticipant?.disputed;

  // ─── Verified / disputed / expired (terminal states) ──────────────────
  if (match.verification_status === "verified") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-900 dark:text-blue-200">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span>
          ✓ {language === "vi" ? "Đã xác nhận" : "Verified"}
          {match.verified_at ? ` ${fmtDate(match.verified_at, language)}` : ""}
        </span>
      </div>
    );
  }
  if (match.verification_status === "disputed") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>
          ⚠{" "}
          {language === "vi"
            ? "Đang tranh chấp — admin sẽ review."
            : "In dispute — admin will review."}
        </span>
      </div>
    );
  }
  if (match.verification_status === "expired") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted p-3 text-sm text-muted-foreground">
        <XCircle className="h-5 w-5 shrink-0" />
        <span>
          {language === "vi"
            ? "Trận đã hết hạn xác nhận (quá 7 ngày)."
            : "Match expired (more than 7 days without confirmation)."}
        </span>
      </div>
    );
  }
  if (match.verification_status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted p-3 text-sm text-muted-foreground">
        <XCircle className="h-5 w-5 shrink-0" />
        <span>{language === "vi" ? "Trận đã bị từ chối." : "Match rejected."}</span>
      </div>
    );
  }

  // ─── Pending — recorder waiting ───────────────────────────────────────
  if (isRecorder) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-900 dark:text-yellow-200">
        <Clock className="h-5 w-5 shrink-0" />
        <span>
          ⏳{" "}
          {language === "vi"
            ? "Chờ đối thủ xác nhận. Họ sẽ nhận thông báo."
            : "Waiting for opponent confirmation. They'll get a notification."}
        </span>
      </div>
    );
  }

  // ─── Pending — participant can confirm/dispute ────────────────────────
  if (isParticipant && !alreadyConfirmed && !alreadyDisputed) {
    const recorderName =
      match.recorder_display_name || match.recorder_username || "Recorder";
    return (
      <div className={cn(
        "rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm",
        "text-yellow-900 dark:text-yellow-200",
      )}>
        <div className="mb-2 flex items-start gap-2">
          <Clock className="h-5 w-5 shrink-0 mt-0.5" />
          <span className="font-medium">
            {language === "vi"
              ? `${recorderName} đã log trận. Xác nhận để cộng vào ranking.`
              : `${recorderName} logged this match. Confirm to count it toward rankings.`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirm.mutate({ match_id: match.id })}
            disabled={confirm.isPending}
            className="bg-social-primary text-white hover:bg-social-primary-dark"
          >
            {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ✓ {language === "vi" ? "Xác nhận" : "Confirm"}
          </Button>
          <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                {language === "vi" ? "Tranh chấp" : "Dispute"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {language === "vi" ? "Tranh chấp tỷ số" : "Dispute the score"}
                </DialogTitle>
                <DialogDescription>
                  {language === "vi"
                    ? "Mô tả vấn đề (tỷ số sai, không đúng người, etc.). Admin sẽ review."
                    : "Describe the issue (wrong score, wrong player, etc.). Admin will review."}
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="dispute-reason">
                  {language === "vi" ? "Lý do" : "Reason"} *
                </Label>
                <Textarea
                  id="dispute-reason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value.slice(0, 500))}
                  placeholder={
                    language === "vi"
                      ? "VD: Game 2 thực ra 11-9, không phải 11-7"
                      : "e.g., Game 2 was actually 11-9, not 11-7"
                  }
                  rows={4}
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-muted-foreground">{disputeReason.length}/500</p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDisputeOpen(false)}>
                  {language === "vi" ? "Hủy" : "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={dispute.isPending || disputeReason.trim().length < 5}
                  onClick={() => {
                    dispute.mutate(
                      { match_id: match.id, dispute_reason: disputeReason.trim() },
                      { onSuccess: () => setDisputeOpen(false) },
                    );
                  }}
                >
                  {dispute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {language === "vi" ? "Gửi tranh chấp" : "Submit dispute"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // ─── Pending — viewer already confirmed ───────────────────────────────
  if (isParticipant && alreadyConfirmed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-900 dark:text-blue-200">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span>
          {language === "vi"
            ? "Bạn đã xác nhận. Đang chờ những người khác."
            : "You confirmed. Waiting on the others."}
        </span>
      </div>
    );
  }
  if (isParticipant && alreadyDisputed) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>
          {language === "vi"
            ? "Bạn đã dispute trận này. Admin sẽ review."
            : "You disputed this match. Admin will review."}
        </span>
      </div>
    );
  }

  // ─── Pending — viewer is non-participant or logged out ────────────────
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-muted p-3 text-sm text-muted-foreground">
      <Clock className="h-5 w-5 shrink-0" />
      <span>
        {language === "vi"
          ? "Trận đang chờ xác nhận từ đối thủ."
          : "Match awaiting confirmation from opponent."}
      </span>
    </div>
  );
};

export default MatchVerifyBanner;
