// ============================================================================
// /match/confirm/:code — public invite-to-confirm landing (Phase A)
// ----------------------------------------------------------------------------
// An opponent (often brand-new to ThePickleHub) opens the share link. We show
// a preview of the match behind the token. If they're not signed in we send
// them through login/registration carrying the token, then back here to
// confirm. Signing in for the first time IS the sign-up — on redeem the edge
// function swaps their ghost slot for their real account and records their
// verification, flipping the proposal to `verified`.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Check, AlertTriangle, CalendarDays, MapPin } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useNoindex } from "@/hooks/useNoindex";
import { useInvitePreview, useRedeemInvite, type InvitePlayerLite } from "@/hooks/useMatchInvite";
import {
  trackInviteOpened,
  trackMatchConfirmed,
  trackSignupFromInvite,
} from "@/utils/invite-events";

const INVITE_RETURN_KEY = "tph.match-invite.from";

function teamNames(team: InvitePlayerLite[] | undefined): string {
  if (!team || team.length === 0) return "—";
  return team.map((p) => p.display_name ?? "—").join(" & ");
}

export default function MatchInviteConfirm() {
  useNoindex();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { language } = useI18n();
  const vi = language === "vi";
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: preview, isLoading, isError } = useInvitePreview(code);
  const redeem = useRedeemInvite();
  const [done, setDone] = useState<"confirm" | "dispute" | null>(null);

  // Fire invite_opened once the preview resolves.
  const previewFound = preview?.found === true;
  useEffect(() => {
    if (code && previewFound) {
      trackInviteOpened({ code, loggedIn: !!user });
    }
  }, [code, previewFound, user]);

  // Coming back here signed in after clicking the login CTA → attribute the
  // sign-up/sign-in to this invite (best-effort loop conversion signal).
  useEffect(() => {
    if (!code || !user) return;
    try {
      if (sessionStorage.getItem(INVITE_RETURN_KEY) === code) {
        trackSignupFromInvite({ code });
        sessionStorage.removeItem(INVITE_RETURN_KEY);
      }
    } catch {
      /* sessionStorage unavailable — non-fatal */
    }
  }, [code, user]);

  const scoreLine = useMemo(() => {
    const a = preview?.team_a_scores ?? [];
    const b = preview?.team_b_scores ?? [];
    if (a.length === 0) return "";
    return a.map((s, i) => `${s}–${b[i] ?? 0}`).join(", ");
  }, [preview]);

  const title = vi ? "Xác nhận trận đấu" : "Confirm match";

  function goLogin() {
    if (!code) return;
    try {
      sessionStorage.setItem(INVITE_RETURN_KEY, code);
    } catch {
      /* non-fatal */
    }
    navigate(`/login?redirect=${encodeURIComponent(`/match/confirm/${code}`)}`);
  }

  async function handle(action: "confirm" | "dispute") {
    if (!code) return;
    let reason: string | undefined;
    if (action === "dispute") {
      const input = window.prompt(
        vi ? "Tỉ số sai ở đâu? (không bắt buộc)" : "What's wrong with the score? (optional)",
      );
      if (input === null) return; // cancelled
      reason = input.trim() || undefined;
    }
    try {
      const result = await redeem.mutateAsync({ code, action, reason });
      trackMatchConfirmed({ proposalId: result.proposal_id, action });
      setDone(action);
      toast({
        title:
          action === "confirm"
            ? vi
              ? "Đã xác nhận trận đấu"
              : "Match confirmed"
            : vi
              ? "Đã gửi báo sai tỉ số"
              : "Score dispute submitted",
      });
    } catch (e) {
      const codeStr = (e as { code?: string; message?: string })?.code ?? "";
      const msg = redeemErrorMessage(codeStr, vi);
      toast({ title: msg, variant: "destructive" });
    }
  }

  // ─── Render states ────────────────────────────────────────────────────────
  if (isLoading || authLoading) {
    return (
      <TheLineLayout title={title}>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  if (isError || !preview || preview.found === false) {
    return (
      <TheLineLayout title={title}>
        <InviteMessage
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          heading={vi ? "Lời mời không tồn tại" : "Invite not found"}
          body={
            vi
              ? "Liên kết này không hợp lệ. Hãy nhờ người ghi trận gửi lại link mới."
              : "This link isn't valid. Ask whoever logged the match to resend it."
          }
        />
      </TheLineLayout>
    );
  }

  const isExpired = preview.expired || preview.status === "expired";
  const isUsed = preview.status === "accepted" || preview.status === "cancelled";

  if (done === "confirm" || preview.match_status === "verified") {
    return (
      <TheLineLayout title={title}>
        <InviteMessage
          icon={<Check className="h-8 w-8 text-primary" />}
          heading={vi ? "Trận đấu đã được xác nhận" : "Match confirmed"}
          body={
            vi
              ? "Cảm ơn anh! Kết quả đã được ghi nhận. Kết nối DUPR để rating tự cập nhật sau mỗi trận."
              : "Thanks! The result is recorded. Connect DUPR so your rating updates after each match."
          }
        >
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/dupr")} variant="default">
              {vi ? "Kết nối DUPR" : "Connect DUPR"}
            </Button>
            <Button onClick={() => navigate("/match?tab=history")} variant="outline">
              {vi ? "Xem trận đấu" : "View matches"}
            </Button>
          </div>
        </InviteMessage>
      </TheLineLayout>
    );
  }

  if (done === "dispute" || isUsed || isExpired) {
    const expiredCopy = isExpired
      ? vi
        ? "Lời mời đã hết hạn."
        : "This invite has expired."
      : vi
        ? "Lời mời này đã được xử lý."
        : "This invite has already been handled.";
    return (
      <TheLineLayout title={title}>
        <InviteMessage
          icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}
          heading={vi ? "Không thể xác nhận" : "Can't confirm"}
          body={done === "dispute" ? (vi ? "Đã gửi báo sai tỉ số cho người ghi trận." : "Your dispute was sent to the recorder.") : expiredCopy}
        />
      </TheLineLayout>
    );
  }

  const inviterName = preview.inviter?.display_name ?? (vi ? "Một người chơi" : "A player");

  return (
    <TheLineLayout title={title}>
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-sm text-muted-foreground">
          {vi ? (
            <><strong className="text-foreground">{inviterName}</strong> mời anh xác nhận tỉ số trận đấu này.</>
          ) : (
            <><strong className="text-foreground">{inviterName}</strong> invited you to confirm this match score.</>
          )}
        </p>

        <div className="mt-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {preview.match_date ?? ""}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium uppercase tracking-wide">
              {preview.format === "DOUBLES" ? (vi ? "Đôi" : "Doubles") : vi ? "Đơn" : "Singles"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <span className="text-sm font-semibold">{teamNames(preview.team_a)}</span>
            <span className="text-2xl font-bold tabular-nums">{scoreLine}</span>
            <span className="text-sm font-semibold">{teamNames(preview.team_b)}</span>
          </div>

          {preview.location ? (
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {preview.location}
            </div>
          ) : null}
        </div>

        {preview.slot_name ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {vi ? "Anh đang xác nhận với tư cách " : "You're confirming as "}
            <strong className="text-foreground">{preview.slot_name}</strong>
          </p>
        ) : null}

        <div className="mt-6">
          {!user ? (
            <Button className="w-full" size="lg" onClick={goLogin}>
              {vi ? "Đăng nhập / Đăng ký để xác nhận" : "Sign in / Sign up to confirm"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                size="lg"
                disabled={redeem.isPending}
                onClick={() => handle("confirm")}
              >
                {redeem.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : vi ? (
                  "Xác nhận tỉ số"
                ) : (
                  "Confirm score"
                )}
              </Button>
              <Button
                className="w-full"
                size="lg"
                variant="ghost"
                disabled={redeem.isPending}
                onClick={() => handle("dispute")}
              >
                {vi ? "Báo sai tỉ số" : "Report wrong score"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
}

function redeemErrorMessage(code: string, vi: boolean): string {
  switch (code) {
    case "cannot_confirm_own_match":
      return vi ? "Anh không thể tự xác nhận trận của mình." : "You can't confirm your own match.";
    case "already_a_player":
      return vi ? "Anh đã có trong trận đấu này." : "You're already in this match.";
    case "invite_expired":
      return vi ? "Lời mời đã hết hạn." : "This invite has expired.";
    case "invite_already_used":
      return vi ? "Lời mời này đã được xử lý." : "This invite was already handled.";
    case "slot_unavailable":
      return vi ? "Vị trí này đã được điền." : "This slot is already filled.";
    default:
      return vi ? "Có lỗi xảy ra, thử lại sau." : "Something went wrong, try again.";
  }
}

function InviteMessage({
  icon,
  heading,
  body,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h1 className="text-lg font-semibold">{heading}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
