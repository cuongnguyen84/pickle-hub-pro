// ============================================================================
// /match/confirm — queue of matches awaiting the user's confirmation
// ----------------------------------------------------------------------------
// When a regular CLB member logs a match, the opposing team is added to
// matches.confirmation_required_from. This page lists those rows for the
// signed-in user and lets them confirm (which triggers an immediate DUPR
// submit) or close without action.
//
// Phase 2 — paired with migration 20260526120000 + the bypass in
// dupr-match-submit that lets the confirming opponent push to DUPR.
// ============================================================================

import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Check } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useMyPendingConfirmations,
  useConfirmClubMatch,
  type PendingConfirmationRow,
  type ClubMatchPlayer,
} from "@/hooks/useClubMatches";

// ─── DUPR auto-submit after opponent confirm (best-effort) ─────────────────
// Per product decision (2026-06-02): confirming a match pushes it to DUPR
// for ALL users. dupr-match-submit authorizes the confirming participant via
// its "confirmed-participant" bypass. Skips quietly when a player has no DUPR
// ID or scores are malformed (leaves the row ready_for_dupr for an admin).
async function submitConfirmedMatchToDupr(
  row: PendingConfirmationRow,
): Promise<{ ok: boolean; matchCode?: string; skipped?: boolean; reason?: string }> {
  const allPlayers = [...row.team_a_players, ...row.team_b_players];
  const aScores = row.team_a_score ?? [];
  const bScores = row.team_b_score ?? [];
  if (
    allPlayers.length === 0 ||
    allPlayers.some((p) => !p.dupr_id) ||
    aScores.length < 1 ||
    aScores.length !== bScores.length
  ) {
    return { ok: false, skipped: true, reason: "preflight" };
  }

  const totalGames = aScores.length;
  const buildTeam = (players: ClubMatchPlayer[], scores: number[]) => {
    const out: Record<string, unknown> = { player1: players[0]?.dupr_id };
    if (players.length > 1) out.player2 = players[1]?.dupr_id;
    for (let i = 0; i < totalGames; i++) out[`game${i + 1}`] = scores[i];
    return out;
  };

  try {
    const { data, error } = await supabase.functions.invoke<{
      match_code?: string;
      error?: string;
      message?: string;
    }>("dupr-match-submit", {
      body: {
        action: "create",
        internal_source: "club_match",
        internal_match_id: row.id,
        match_date: row.played_at.slice(0, 10),
        location: "ThePickleHub CLB",
        format: row.format === "singles" ? "SINGLES" : "DOUBLES",
        match_type: "SIDEOUT",
        event: "ThePickleHub CLB match",
        bracket: "",
        team_a: buildTeam(row.team_a_players, aScores),
        team_b: buildTeam(row.team_b_players, bScores),
      },
    });

    if (error) {
      const ctx = (error as { context?: Response }).context;
      let detail = error.message ?? "submit_failed";
      if (ctx) {
        try {
          const b = await ctx.clone().json();
          detail = b.error ?? b.message ?? b.code ?? detail;
        } catch {
          /* keep default */
        }
      }
      return { ok: false, reason: detail };
    }
    if (!data?.match_code) {
      return { ok: false, reason: data?.error ?? data?.message ?? "no_match_code" };
    }
    return { ok: true, matchCode: data.match_code };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "submit_failed" };
  }
}

export default function MatchConfirm() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useI18n();
  const vi = language === "vi";

  const { rows, isLoading, refetch } = useMyPendingConfirmations();

  if (authLoading) {
    return (
      <TheLineLayout title="Confirm matches">
        <div className="mx-auto max-w-2xl p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </TheLineLayout>
    );
  }

  if (!user) {
    return (
      <TheLineLayout title="Confirm matches">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-2xl font-semibold mb-3">
            {vi ? "Cần đăng nhập" : "Sign in required"}
          </h1>
          <p style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Anh đăng nhập rồi quay lại để xem các trận đang chờ xác nhận."
              : "Sign in to see matches waiting for your confirmation."}
          </p>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout
      title={vi ? "Xác nhận trận đấu" : "Confirm matches"}
      description={
        vi
          ? "Trận đấu đối thủ vừa nhập tỉ số — anh xem rồi xác nhận."
          : "Matches opponents have logged — review and confirm."
      }
      noindex
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <h1
            className="text-3xl font-semibold mb-2"
            style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
          >
            {vi ? "Xác nhận trận đấu" : "Confirm matches"}
          </h1>
          <p style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Đối thủ vừa nhập tỉ số. Kiểm tra rồi bấm xác nhận — trận sẽ được gửi lên DUPR ngay."
              : "Your opponent logged the score. Review it, then confirm — the match is sent to DUPR right away."}
          </p>
        </header>

        {isLoading ? (
          <div
            className="rounded-md border p-12 text-center"
            style={{ borderColor: "var(--tl-border)" }}
          >
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div
            className="rounded-md border p-10 text-center"
            style={{ borderColor: "var(--tl-border)" }}
          >
            <CheckCircle2
              className="mx-auto mb-3"
              style={{ width: 28, height: 28, color: "var(--tl-fg-3)" }}
            />
            <h2 className="text-lg font-semibold mb-1">
              {vi ? "Không có gì chờ xác nhận" : "Nothing to confirm"}
            </h2>
            <p style={{ color: "var(--tl-fg-3)" }}>
              {vi
                ? "Khi đối thủ log trận đấu, em sẽ thông báo anh ở đây."
                : "When opponents log matches, they'll show up here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <PendingMatchCard key={row.id} row={row} onDone={() => refetch()} />
            ))}
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}

function PendingMatchCard({
  row,
  onDone,
}: {
  row: PendingConfirmationRow;
  onDone: () => void;
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const vi = language === "vi";

  const confirm = useConfirmClubMatch();
  const [stage, setStage] = useState<"idle" | "confirming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setStage("confirming");

    try {
      // 1. Flip confirmation_status → 'confirmed' + ready_for_dupr=true.
      await confirm.mutateAsync({ matchId: row.id });

      // 2. Auto-submit to DUPR. Product decision (2026-06-02): opponent
      //    confirm pushes the match to DUPR for ALL users (supersedes the
      //    2026-05-26 admin-only deferral). Best-effort — a failure here must
      //    not undo the confirm, so we only adjust the toast copy.
      const submitResult = await submitConfirmedMatchToDupr(row);
      let duprNote: string;
      if (submitResult.ok && submitResult.matchCode) {
        duprNote = vi
          ? `Đã gửi lên DUPR · matchCode ${submitResult.matchCode}`
          : `Submitted to DUPR · matchCode ${submitResult.matchCode}`;
      } else if (submitResult.skipped) {
        duprNote = vi
          ? "Quản trị CLB sẽ gửi lên DUPR (thiếu DUPR ID / tỉ số)."
          : "Your CLB admin will submit to DUPR (missing DUPR ID / score).";
      } else {
        duprNote = vi
          ? `Gửi DUPR chưa xong: ${submitResult.reason ?? "lỗi"} — admin sẽ thử lại.`
          : `DUPR submit pending: ${submitResult.reason ?? "error"} — admin can retry.`;
      }

      setStage("done");
      toast({
        title: vi ? "Đã xác nhận trận đấu" : "Match confirmed",
        description: duprNote,
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "confirm_failed";
      setError(msg);
      setStage("idle");
      toast({
        variant: "destructive",
        title: vi ? "Lỗi" : "Failed",
        description: msg,
      });
    }
  }

  const aWins = row.winning_team === "a";
  const bWins = row.winning_team === "b";

  return (
    <article
      className="rounded-md border p-5"
      style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}
    >
      <div
        className="flex items-center justify-between mb-3 text-xs"
        style={{
          fontFamily: "'Geist Mono', monospace",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--tl-fg-3)",
        }}
      >
        <span>
          {row.club_slug ? (
            <Link
              to={`/clb/${row.club_slug}`}
              className="underline"
              style={{ color: "var(--tl-fg-2)" }}
            >
              {row.club_name ?? row.club_slug}
            </Link>
          ) : (
            <span>{vi ? "Trận đấu" : "Match"}</span>
          )}
          {" · "}
          {new Date(row.played_at).toLocaleDateString()}
        </span>
        <span>
          {vi ? "Ghi bởi" : "Logged by"} {row.recorded_by_name ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4">
        <TeamSummary players={row.team_a_players} highlighted={aWins} />
        <ScoreLine
          a={row.team_a_score}
          b={row.team_b_score}
          aWins={aWins}
          bWins={bWins}
        />
        <TeamSummary
          players={row.team_b_players}
          highlighted={bWins}
          align="right"
        />
      </div>

      {row.notes && (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--tl-fg-3)", lineHeight: 1.5 }}
        >
          {row.notes}
        </p>
      )}

      {stage === "done" ? (
        <div
          className="flex items-start gap-2 text-sm"
          style={{ color: "var(--tl-green)", lineHeight: 1.5 }}
        >
          <CheckCircle2
            style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>
              {vi ? "Đã xác nhận trận đấu" : "Match confirmed"}
            </div>
            <div style={{ color: "var(--tl-fg-3)", marginTop: 2 }}>
              {vi
                ? "Trận đã được xác nhận và đồng bộ lên DUPR."
                : "Match confirmed and synced to DUPR."}
            </div>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-md p-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--tl-live, #ef4444)",
                lineHeight: 1.55,
              }}
            >
              <strong>{vi ? "Lỗi:" : "Error:"}</strong> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={stage !== "idle"}
              className="tl-btn primary"
              style={{
                opacity: stage !== "idle" ? 0.6 : 1,
                cursor: stage !== "idle" ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {stage === "confirming" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {vi ? "Đang xác nhận..." : "Confirming..."}
                </>
              ) : (
                <>
                  <Check style={{ width: 14, height: 14 }} />
                  {vi ? "Xác nhận tỉ số" : "Confirm score"}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function TeamSummary({
  players,
  highlighted,
  align = "left",
}: {
  players: ClubMatchPlayer[];
  highlighted: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className="flex flex-col gap-0.5"
      style={{ textAlign: align, fontWeight: highlighted ? 600 : 400 }}
    >
      {players.map((p) => (
        <div
          key={p.profile_id}
          className="text-sm truncate"
          style={{ color: highlighted ? "var(--tl-fg)" : "var(--tl-fg-2)" }}
          title={p.display_name ?? p.profile_id}
        >
          {p.display_name ?? "—"}
        </div>
      ))}
    </div>
  );
}

function ScoreLine({
  a,
  b,
  aWins,
  bWins,
}: {
  a: number[];
  b: number[];
  aWins: boolean;
  bWins: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2"
      style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 18,
        letterSpacing: "0.04em",
        color: "var(--tl-fg)",
      }}
    >
      <div className="flex flex-col items-end gap-0.5">
        {a.map((s, i) => (
          <span
            key={`a-${i}`}
            style={{
              opacity: aWins && b[i] !== undefined && s > b[i] ? 1 : 0.55,
              fontWeight: aWins ? 600 : 400,
            }}
          >
            {s}
          </span>
        ))}
      </div>
      <span style={{ color: "var(--tl-fg-3)", fontSize: 12 }}>—</span>
      <div className="flex flex-col items-start gap-0.5">
        {b.map((s, i) => (
          <span
            key={`b-${i}`}
            style={{
              opacity: bWins && a[i] !== undefined && s > a[i] ? 1 : 0.55,
              fontWeight: bWins ? 600 : 400,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
