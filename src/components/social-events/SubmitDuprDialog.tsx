// ============================================================================
// SubmitDuprDialog — 1-click admin direct-submit to DUPR.
// ----------------------------------------------------------------------------
// REWRITTEN 2026-05-26 — prior version exposed raw JSON payload + manual
// matchCode input because DUPR Partner API wasn't live. Now that we have
// prod credentials and dupr-match-submit edge function works, the dialog
// is collapsed to:
//
//   1. Pre-flight checks — every player has DUPR ID, scores valid, winner
//      determined. Same logic as before but more compact.
//   2. ONE primary action — "Gửi lên DUPR" calls the edge function and
//      shows the returned matchCode on success.
//
// No more JSON, no more matchCode input. Admin/creator only path —
// member self-submit with opponent-confirm lives in a separate flow
// (Phase 2 — not yet built).
// ============================================================================
//
// Note on i18n: this dialog uses inline vi/en strings instead of the
// translations dict because the old t.socialEvents.matches.submit keys
// (payloadHeading, manualSubmitCta, sendViaApi, etc.) describe a UX that
// no longer exists. Keeping the old keys around as dead translations
// makes the dict confusing for future contributors — better to inline
// here and prune the dict when convenient.
// ============================================================================

import { useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, Loader2, XCircle, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ClubMatchRow } from "@/hooks/useClubMatches";

interface Props {
  match: ClubMatchRow;
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Style primitives ────────────────────────────────────────────────────

const labelStyle: CSSProperties = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-fg-3)",
};

const sectionStyle: CSSProperties = {
  padding: "18px 0",
  borderTop: "1px solid var(--tl-border)",
};

interface CheckRow {
  label: string;
  passed: boolean;
  detail?: string;
}

function CheckList({ rows }: { rows: CheckRow[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {rows.map((row, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: row.passed ? "var(--tl-fg)" : "var(--tl-fg-2)",
          }}
        >
          {row.passed ? (
            <CheckCircle2
              style={{
                width: 16,
                height: 16,
                color: "var(--tl-green)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
          ) : (
            <XCircle
              style={{
                width: 16,
                height: 16,
                color: "var(--tl-live)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{row.label}</div>
            {row.detail && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: row.passed ? "var(--tl-fg-3)" : "var(--tl-live)",
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                {row.detail}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SubmitDuprDialog({ match, clubId, open, onOpenChange }: Props) {
  const { language } = useI18n();
  const vi = language === "vi";
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingBasicL1, setMissingBasicL1] = useState<string[] | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Map a list of DUPR IDs back to display names for friendlier errors.
  const allPlayers = useMemo(
    () => [...match.team_a_players, ...match.team_b_players],
    [match],
  );
  const namesForDuprIds = (ids: string[]): string[] =>
    ids.map((id) => {
      const p = allPlayers.find((x) => x.dupr_id === id);
      return p?.display_name ?? id;
    });

  // ─── Pre-flight validation ──────────────────────────────────────────────
  const checks = useMemo<CheckRow[]>(() => {
    const allPlayers = [...match.team_a_players, ...match.team_b_players];
    const missingDupr = allPlayers.filter((p) => !p.dupr_id);

    const totalGames = match.team_a_score.length;
    const scoresOk =
      totalGames >= 1 &&
      totalGames <= 5 &&
      match.team_a_score.length === match.team_b_score.length &&
      match.team_a_score.every((s) => Number.isFinite(s) && s >= 0) &&
      match.team_b_score.every((s) => Number.isFinite(s) && s >= 0);

    return [
      {
        label: vi
          ? "Mọi người chơi đều có DUPR ID"
          : "All players have a DUPR ID",
        passed: missingDupr.length === 0,
        detail:
          missingDupr.length === 0
            ? `${allPlayers.length}/${allPlayers.length}`
            : (vi ? "Thiếu DUPR: " : "Missing DUPR: ") +
              missingDupr.map((p) => p.display_name ?? "—").join(", "),
      },
      {
        label: vi ? "Tỉ số hợp lệ" : "Scores look valid",
        passed: scoresOk,
        detail: scoresOk
          ? `${totalGames} ${totalGames === 1 ? (vi ? "ván" : "game") : (vi ? "ván" : "games")}`
          : (vi ? "Tỉ số chưa đúng format" : "Score format invalid"),
      },
      {
        label: vi ? "Đã xác định team thắng" : "Winning team determined",
        passed: match.winning_team !== null,
        detail:
          match.winning_team === "a"
            ? (vi ? "Team A thắng" : "Team A wins")
            : match.winning_team === "b"
              ? (vi ? "Team B thắng" : "Team B wins")
              : (vi ? "Chưa xác định" : "Not set"),
      },
    ];
  }, [match, vi]);

  const allChecksPassed = checks.every((c) => c.passed);

  // ─── Action handler ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!allChecksPassed) return;
    setSubmitting(true);
    setError(null);
    setMissingBasicL1(null);

    // Hoisted out of try/catch so we can populate it from the response
    // body and read it in the catch path for state setting.
    let detectedMissing: string[] | null = null;

    try {
      const totalGames = match.team_a_score.length;
      const buildTeam = (players: typeof match.team_a_players, scores: number[]) => {
        const out: Record<string, unknown> = { player1: players[0]?.dupr_id };
        if (players.length > 1) out.player2 = players[1]?.dupr_id;
        for (let i = 0; i < totalGames; i++) out[`game${i + 1}`] = scores[i];
        return out;
      };

      const { data, error: invokeError } = await supabase.functions.invoke<{
        // Edge function returns flat snake_case on success.
        created?: boolean;
        match_code?: string;
        hashed_match_code?: string | null;
        identifier?: string;
        // Error shape.
        error?: string;
        code?: string;
        message?: string;
        details?: { missing?: string[] };
      }>("dupr-match-submit", {
        body: {
          action: "create",
          internal_source: "club_match",
          internal_match_id: match.id,
          match_date: match.played_at.slice(0, 10),
          location: "ThePickleHub CLB",
          format: match.format === "singles" ? "SINGLES" : "DOUBLES",
          match_type: "SIDEOUT",
          event: "ThePickleHub CLB match",
          bracket: "",
          team_a: buildTeam(match.team_a_players, match.team_a_score),
          team_b: buildTeam(match.team_b_players, match.team_b_score),
        },
      });

      if (invokeError) {
        // Surface the real server-side reason — supabase-js wraps non-2xx
        // as FunctionsHttpError with the body on context.
        const ctx = (invokeError as { context?: Response }).context;
        let detail = invokeError.message ?? "submit_failed";
        if (ctx) {
          try {
            const body = await ctx.clone().json();
            detail = body.error ?? body.message ?? body.code ?? detail;
            // dupr-match-submit returns { error: 'players_missing_basic_l1',
            // details: { missing: [duprId, ...] } } on 412 — surface the
            // affected players by name so the admin knows exactly who
            // needs to connect DUPR.
            if (
              body.error === "players_missing_basic_l1" &&
              Array.isArray(body.details?.missing)
            ) {
              detectedMissing = body.details.missing as string[];
            }
          } catch {
            /* keep default */
          }
        }
        throw new Error(detail);
      }

      const matchCode = data?.match_code;
      if (!matchCode) {
        throw new Error(data?.error ?? data?.message ?? "no_match_code");
      }

      setSuccessCode(matchCode);
      toast({
        title: vi ? "Đã gửi lên DUPR" : "Submitted to DUPR",
        description: `matchCode: ${matchCode}`,
      });

      // Refresh the matches list so the row flips to "Sent to DUPR".
      void qc.invalidateQueries({ queryKey: ["club-matches", clubId] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "submit_failed";
      setError(msg);
      // If the failure was the BASIC_L1 gate, lift the affected player
      // list into state so the UI can render a friendlier panel below
      // the error banner.
      if (detectedMissing && detectedMissing.length > 0) {
        setMissingBasicL1(detectedMissing);
      }
      toast({
        title: vi ? "Gửi thất bại" : "Submit failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    // Reset state when closing.
    if (!submitting) {
      setError(null);
      setMissingBasicL1(null);
      setSuccessCode(null);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className="max-w-md p-0 border-0"
        style={{
          background: "var(--tl-bg)",
          color: "var(--tl-fg)",
          borderRadius: 14,
        }}
      >
        <VisuallyHidden>
          <DialogTitle>{vi ? "Gửi trận lên DUPR" : "Submit match to DUPR"}</DialogTitle>
          <DialogDescription>
            {vi
              ? "Kiểm tra điều kiện rồi gửi trận đấu lên DUPR để chấm rating chính thức."
              : "Validate the match then push it to DUPR for official rating."}
          </DialogDescription>
        </VisuallyHidden>

        {/* ─── Header ─── */}
        <div style={{ padding: "26px 24px 18px" }}>
          <div className="tl-eyebrow" style={{ marginBottom: 10 }}>
            <span className="pip" />
            <span>{vi ? "Gửi lên DUPR" : "Submit to DUPR"}</span>
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
              margin: "0 0 6px",
            }}
          >
            {vi ? "Trận này sẵn sàng?" : "Ready to submit?"}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--tl-fg-3)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {vi
              ? "Trận đấu sẽ được gửi thẳng lên DUPR để chấm rating chính thức. Mất vài giây."
              : "The match goes straight to DUPR for official rating. Takes a few seconds."}
          </p>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: "0 24px" }}>
          {/* Success state */}
          {successCode ? (
            <div
              style={{
                padding: "20px 0 4px",
                textAlign: "center",
              }}
            >
              <CheckCircle2
                style={{
                  width: 40,
                  height: 40,
                  color: "var(--tl-green)",
                  margin: "0 auto 12px",
                }}
              />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                {vi ? "Đã gửi lên DUPR" : "Sent to DUPR"}
              </div>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 13,
                  color: "var(--tl-fg-2)",
                  marginBottom: 4,
                }}
              >
                matchCode: {successCode}
              </div>
              <div style={{ fontSize: 12, color: "var(--tl-fg-3)", lineHeight: 1.5 }}>
                {vi
                  ? "DUPR sẽ cập nhật rating của người chơi trong vài giờ tới."
                  : "DUPR will update player ratings within a few hours."}
              </div>
            </div>
          ) : (
            <>
              {/* Validation panel */}
              <div style={{ ...sectionStyle, paddingTop: 0, borderTop: "none" }}>
                <div style={{ ...labelStyle, marginBottom: 12 }}>
                  {vi ? "Kiểm tra trước khi gửi" : "Pre-flight checks"}
                </div>
                <CheckList rows={checks} />
                {!allChecksPassed && (
                  <p
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      background: "var(--tl-surface)",
                      borderLeft: "2px solid var(--tl-live)",
                      fontSize: 13,
                      color: "var(--tl-fg-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    {vi
                      ? "Sửa các mục đỏ trên trước khi gửi. Nếu thiếu DUPR ID, người chơi cần kết nối DUPR trước."
                      : "Fix the items marked red before submitting. If a DUPR ID is missing, that player must connect DUPR first."}
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  style={{
                    marginTop: 8,
                    padding: "14px 16px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--tl-live, #ef4444)",
                    lineHeight: 1.55,
                  }}
                >
                  {/* Special case: BASIC_L1 entitlement missing — give
                      admin a clear explanation + the exact players who
                      need to act. */}
                  {missingBasicL1 && missingBasicL1.length > 0 ? (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        {vi
                          ? "Người chơi chưa cấp quyền DUPR cho ThePickleHub"
                          : "Players haven't granted DUPR permission to ThePickleHub"}
                      </div>
                      <ul
                        style={{
                          listStyle: "disc",
                          paddingLeft: 20,
                          margin: "0 0 10px",
                          color: "var(--tl-fg)",
                        }}
                      >
                        {namesForDuprIds(missingBasicL1).map((name, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            <span
                              style={{
                                marginLeft: 8,
                                fontFamily: "'Geist Mono', monospace",
                                fontSize: 11,
                                color: "var(--tl-fg-3)",
                              }}
                            >
                              {missingBasicL1[i]}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div style={{ color: "var(--tl-fg-2)", fontSize: 12.5 }}>
                        {vi ? (
                          <>
                            DUPR yêu cầu mỗi người chơi tự kết nối DUPR qua
                            ThePickleHub (entitlement <code>BASIC_L1</code>)
                            trước khi mình submit trận. Báo họ vào{" "}
                            <strong>thepicklehub.net/dupr</strong> → bấm{" "}
                            <strong>"Kết nối DUPR"</strong> rồi đồng ý cấp quyền.
                            Sau đó quay lại bấm submit.
                          </>
                        ) : (
                          <>
                            DUPR requires each player to connect via
                            ThePickleHub (the <code>BASIC_L1</code>{" "}
                            entitlement) before we can submit on their
                            behalf. Ask them to visit{" "}
                            <strong>thepicklehub.net/dupr</strong> → click{" "}
                            <strong>"Connect DUPR"</strong> and approve the
                            permission. Then come back and submit again.
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>{vi ? "Gửi thất bại:" : "Submit failed:"}</strong>{" "}
                      {error}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Action row ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 24px 22px",
            borderTop: successCode ? "none" : "1px solid var(--tl-border)",
            marginTop: 4,
          }}
        >
          {successCode ? (
            <button
              type="button"
              onClick={handleClose}
              className="tl-btn primary"
              style={{ minWidth: 100 }}
            >
              {vi ? "Xong" : "Done"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="tl-btn"
                disabled={submitting}
              >
                {vi ? "Huỷ" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allChecksPassed || submitting}
                className="tl-btn primary"
                style={{
                  opacity: !allChecksPassed || submitting ? 0.5 : 1,
                  cursor:
                    !allChecksPassed || submitting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send style={{ width: 14, height: 14 }} />
                )}
                {submitting
                  ? vi
                    ? "Đang gửi..."
                    : "Sending..."
                  : vi
                    ? "Gửi lên DUPR"
                    : "Submit to DUPR"}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
