// ============================================================================
// SubmitDuprDialog — organizer-only modal to push a match to DUPR.
// ----------------------------------------------------------------------------
// Two-path design while DUPR Partner RAAS API access is still pending:
//
//   1. **Validation panel** — pre-flight checks (every player has a DUPR
//      ID, scores look valid, format compatible). Shows pass/fail per
//      item so the organizer knows exactly what's missing.
//
//   2. **Payload preview** — JSON the future edge function will POST to
//      DUPR. Copy-paste-friendly so the organizer can submit via the
//      DUPR dashboard manually while we wait for the API.
//
//   3. **Two actions:**
//      - "Đợi API DUPR" — disabled stub; will be wired to the real edge
//        function `dupr-match-submit` once RAAS is granted.
//      - "Tôi đã submit thủ công" — paste matchCode → calls
//        mark_match_submitted_to_dupr RPC → marks the row submitted.
//
// Restyled in TheLine vocabulary to match LogMatchDialog.
// ============================================================================

import { useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import {
  useMarkMatchSubmittedToDupr,
  type ClubMatchRow,
} from "@/hooks/useClubMatches";

interface Props {
  match: ClubMatchRow;
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Shared TheLine inline style primitives ───────────────────────────────

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

const codeBlockStyle: CSSProperties = {
  background: "var(--tl-surface)",
  border: "1px solid var(--tl-border)",
  borderRadius: 8,
  padding: 14,
  fontFamily: "'Geist Mono', monospace",
  fontSize: 12,
  lineHeight: 1.55,
  color: "var(--tl-fg-2)",
  whiteSpace: "pre",
  overflow: "auto",
  maxHeight: 240,
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--tl-border)",
  borderRadius: 0,
  padding: "10px 0",
  fontSize: 15,
  fontFamily: "'Geist Mono', monospace",
  color: "var(--tl-fg)",
  outline: "none",
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
  const { t } = useI18n();
  const m = t.socialEvents.matches.submit;
  const markSubmitted = useMarkMatchSubmittedToDupr(clubId);
  const [duprCode, setDuprCode] = useState("");

  // ─── Build validation rows ──────────────────────────────────────────────
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
        label: m.checkAllPlayersHaveDupr,
        passed: missingDupr.length === 0,
        detail:
          missingDupr.length === 0
            ? `${allPlayers.length}/${allPlayers.length}`
            : m.checkMissingDuprDetail.replace(
                "{names}",
                missingDupr.map((p) => p.display_name ?? "—").join(", "),
              ),
      },
      {
        label: m.checkScoresValid,
        passed: scoresOk,
        detail: scoresOk
          ? `${totalGames} ${totalGames === 1 ? m.gameSingular : m.gamePlural}`
          : m.checkScoresInvalidDetail,
      },
      {
        label: m.checkWinnerDetermined,
        passed: match.winning_team !== null,
        detail:
          match.winning_team === "a"
            ? m.winnerTeamA
            : match.winning_team === "b"
              ? m.winnerTeamB
              : m.winnerNone,
      },
    ];
  }, [match, m]);

  const allChecksPassed = checks.every((c) => c.passed);

  // ─── Build DUPR API payload preview ─────────────────────────────────────
  const payload = useMemo(() => {
    const formatDupr =
      match.format === "singles" ? "SINGLES" : "DOUBLES";
    const games = match.team_a_score.length;
    function buildTeam(players: typeof match.team_a_players, scores: number[]) {
      const out: Record<string, unknown> = {
        player1: players[0]?.dupr_id ?? "<MISSING>",
      };
      if (players.length > 1) out.player2 = players[1]?.dupr_id ?? "<MISSING>";
      for (let i = 0; i < games; i++) {
        out[`game${i + 1}`] = scores[i];
      }
      return out;
    }
    return {
      identifier: `tph:club:${match.id}`,
      matchDate: match.played_at.slice(0, 10),
      location: "ThePickleHub CLB",
      format: formatDupr,
      matchType: "SIDEOUT",
      event: "ThePickleHub CLB match",
      bracket: "",
      teamA: buildTeam(match.team_a_players, match.team_a_score),
      teamB: buildTeam(match.team_b_players, match.team_b_score),
    };
  }, [match]);

  const payloadJson = JSON.stringify(payload, null, 2);

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payloadJson);
      toast({ title: m.copied });
    } catch {
      toast({ title: m.copyError, variant: "destructive" });
    }
  }

  async function handleManualSubmit() {
    const code = duprCode.trim();
    if (code.length < 1) {
      toast({ title: m.errMatchCodeRequired, variant: "destructive" });
      return;
    }
    try {
      await markSubmitted.mutateAsync({ matchId: match.id, duprMatchId: code });
      toast({ title: m.manualSubmitSuccess });
      setDuprCode("");
      onOpenChange(false);
    } catch (e) {
      const errCode = (e as { code?: string })?.code ?? "";
      const msg =
        errCode === "already_submitted"
          ? m.errAlreadySubmitted
          : errCode === "not_authorized"
            ? t.socialEvents.managers.errNotAuthorized
            : errCode === "dupr_match_id_too_long"
              ? m.errMatchCodeTooLong
              : m.manualSubmitError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl max-h-[92vh] overflow-y-auto p-0 border-0"
        style={{
          background: "var(--tl-bg)",
          color: "var(--tl-fg)",
          borderRadius: 14,
        }}
      >
        <VisuallyHidden>
          <DialogTitle>{m.dialogTitle}</DialogTitle>
          <DialogDescription>{m.dialogDesc}</DialogDescription>
        </VisuallyHidden>

        <div style={{ padding: "28px 26px 22px" }}>
          <div className="tl-eyebrow" style={{ marginBottom: 10 }}>
            <span className="pip" />
            <span>{m.eyebrow}</span>
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              margin: "0 0 8px",
              color: "var(--tl-fg)",
            }}
          >
            {m.dialogTitle}.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--tl-fg-3)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {m.dialogDesc}
          </p>
        </div>

        <div style={{ padding: "0 26px" }}>
          {/* ─── Validation ─── */}
          <div style={{ ...sectionStyle, paddingTop: 0, borderTop: "none" }}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>
              {m.validationHeading}
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
                {m.fixBeforeSubmit}
              </p>
            )}
          </div>

          {/* ─── Payload preview ─── */}
          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={labelStyle}>{m.payloadHeading}</span>
              <button
                type="button"
                onClick={copyPayload}
                className="tl-btn"
                style={{ padding: "5px 11px", fontSize: 12 }}
              >
                <Copy style={{ width: 12, height: 12 }} />
                {m.copyPayload}
              </button>
            </div>
            <pre style={codeBlockStyle}>{payloadJson}</pre>
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--tl-fg-3)",
                lineHeight: 1.5,
              }}
            >
              {m.payloadHint}
            </p>
          </div>

          {/* ─── Manual override ─── */}
          <div style={sectionStyle}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>
              {m.manualHeading}
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--tl-fg-3)",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              {m.manualDesc}
            </p>
            <label
              htmlFor="dupr-code"
              style={{ ...labelStyle, display: "block", marginBottom: 6 }}
            >
              {m.matchCodeLabel}
            </label>
            <input
              id="dupr-code"
              type="text"
              value={duprCode}
              onChange={(e) => setDuprCode(e.target.value)}
              placeholder="e.g. 5271241957"
              maxLength={64}
              style={inputStyle}
              autoComplete="off"
            />
          </div>
        </div>

        {/* ─── Action row ─── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 10,
            padding: "16px 26px 24px",
            borderTop: "1px solid var(--tl-border)",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            disabled
            className="tl-btn"
            title={m.pendingApiTooltip}
            style={{ opacity: 0.4, cursor: "not-allowed" }}
          >
            {m.sendViaApi}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="tl-btn"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={markSubmitted.isPending || duprCode.trim().length < 1}
              className="tl-btn green"
              style={{
                opacity:
                  markSubmitted.isPending || duprCode.trim().length < 1
                    ? 0.6
                    : 1,
              }}
            >
              {markSubmitted.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {m.manualSubmitCta}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
