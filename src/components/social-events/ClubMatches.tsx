// ============================================================================
// ClubMatches — section rendered on /clb/:slug listing club-logged matches.
// ----------------------------------------------------------------------------
// Restyled in TheLine vocabulary:
//   - tl-eyebrow + Geist Mono uppercase section header
//   - Instrument Serif italic title with "." period flourish
//   - Match cards are bordered surfaces (no shadcn Card defaults)
//   - Score columns rendered as monospace pills, winner gets a green stroke
//   - Status badges use tl-eyebrow-style tokens
// ============================================================================

import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import {
  useClubMatches,
  useMarkMatchReadyForDupr,
  type ClubMatchRow,
} from "@/hooks/useClubMatches";
import { LogMatchDialog } from "./LogMatchDialog";
import { SubmitDuprDialog } from "./SubmitDuprDialog";

interface Props {
  clubId: string;
  isOrganizer: boolean;
}

function formatPlayedAt(iso: string, lang: "vi" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── TheLine shared style primitives ──────────────────────────────────────

const monoLabelStyle: CSSProperties = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-fg-3)",
};

const cardStyle: CSSProperties = {
  background: "var(--tl-surface)",
  border: "1px solid var(--tl-border)",
  borderRadius: 14,
  padding: 18,
};

const statusChipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 4,
  fontFamily: "'Geist Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  border: "1px solid var(--tl-border)",
};

type MatchStatusKind =
  | "submitted"
  | "ready"
  | "draft"
  | "pending_confirm"
  | "confirmed";

function StatusChip({
  status,
  m,
  lang,
}: {
  status: MatchStatusKind;
  m: ReturnType<typeof useI18n>["t"]["socialEvents"]["matches"];
  lang: "vi" | "en";
}) {
  if (status === "submitted") {
    return (
      <span
        style={{
          ...statusChipBase,
          color: "var(--tl-green)",
          borderColor: "var(--tl-green)",
        }}
      >
        <CheckCircle2 style={{ width: 11, height: 11 }} />
        {m.submittedBadge}
      </span>
    );
  }
  if (status === "pending_confirm") {
    // Member-logged match waiting on opposing team. Amber dashed border
    // signals an action is needed before this row can ship.
    return (
      <span
        style={{
          ...statusChipBase,
          color: "var(--tl-amber, #f59e0b)",
          borderColor: "var(--tl-amber, #f59e0b)",
          borderStyle: "dashed",
        }}
      >
        <Clock style={{ width: 11, height: 11 }} />
        {lang === "vi" ? "Chờ đối thủ xác nhận" : "Waiting for opponent"}
      </span>
    );
  }
  if (status === "confirmed") {
    // Opponent has signed off — now waiting on an admin/organizer to
    // perform the actual DUPR submit (per DUPR spec).
    return (
      <span
        style={{
          ...statusChipBase,
          color: "var(--tl-gold)",
          borderColor: "var(--tl-gold)",
        }}
      >
        <CheckCircle2 style={{ width: 11, height: 11 }} />
        {lang === "vi" ? "Đối thủ đã xác nhận" : "Confirmed by opponent"}
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span
        style={{
          ...statusChipBase,
          color: "var(--tl-gold)",
          borderColor: "var(--tl-gold)",
        }}
      >
        <UploadCloud style={{ width: 11, height: 11 }} />
        {m.readyBadge}
      </span>
    );
  }
  return (
    <span style={{ ...statusChipBase, color: "var(--tl-fg-4)" }}>
      <Clock style={{ width: 11, height: 11 }} />
      {m.draftBadge}
    </span>
  );
}

function ScoreGames({
  ours,
  theirs,
  highlight,
}: {
  ours: number[];
  theirs: number[];
  highlight: "win" | "lose" | "tie";
}) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {ours.map((s, i) => {
        const won = s > (theirs[i] ?? 0);
        return (
          <span
            key={i}
            style={{
              minWidth: 28,
              padding: "4px 8px",
              borderRadius: 4,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 15,
              textAlign: "center",
              background:
                highlight !== "tie" && won ? "var(--tl-green-glow)" : "transparent",
              border: "1px solid var(--tl-border)",
              color: won ? "var(--tl-fg)" : "var(--tl-fg-3)",
            }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function MatchCard({
  match,
  isOrganizer,
  clubId,
  lang,
}: {
  match: ClubMatchRow;
  isOrganizer: boolean;
  clubId: string;
  lang: "vi" | "en";
}) {
  const { t } = useI18n();
  const m = t.socialEvents.matches;
  const markReady = useMarkMatchReadyForDupr(clubId);
  const [submitOpen, setSubmitOpen] = useState(false);

  const teamALabel = match.team_a_players
    .map((p) => p.display_name ?? "—")
    .join(" + ");
  const teamBLabel = match.team_b_players
    .map((p) => p.display_name ?? "—")
    .join(" + ");

  // Status derivation — priority: submitted > pending_confirm > confirmed >
  // ready > draft. The confirmation_status column gates the new flow;
  // ready_for_dupr remains the "draft → ready" admin toggle for
  // auto_confirmed_admin rows.
  const status: MatchStatusKind = match.submitted_to_dupr
    ? "submitted"
    : match.confirmation_status === "pending_opponent_confirm"
      ? "pending_confirm"
      : match.confirmation_status === "confirmed"
        ? "confirmed"
        : match.ready_for_dupr
          ? "ready"
          : "draft";

  async function handleToggleReady(next: boolean): Promise<void> {
    try {
      await markReady.mutateAsync({ matchId: match.id, ready: next });
      toast({ title: next ? m.readyOn : m.readyOff });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const msg =
        code === "already_submitted"
          ? m.errAlreadySubmitted
          : code === "not_authorized"
            ? t.socialEvents.managers.errNotAuthorized
            : m.toggleError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  const formatLabel =
    match.format === "singles"
      ? m.formatSingles
      : match.format === "mixed"
        ? m.formatMixed
        : m.formatDoubles;

  return (
    <article style={cardStyle}>
      {/* Top row: format + status chips + date + detail link */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ ...statusChipBase, color: "var(--tl-fg-3)" }}>
            {formatLabel}
          </span>
          <StatusChip status={status} m={m} lang={lang} />
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...monoLabelStyle, marginBottom: 2 }}>
            {formatPlayedAt(match.played_at, lang)}
          </div>
          <Link
            to={`/tran-dau/${match.slug}`}
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--tl-fg-3)",
              textDecoration: "none",
            }}
          >
            {m.viewDetail}
          </Link>
        </div>
      </header>

      {/* Teams grid — Team A | scores | Team B */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 18,
            fontWeight: match.winning_team === "a" ? 500 : 400,
            color:
              match.winning_team === "a"
                ? "var(--tl-fg)"
                : "var(--tl-fg-2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {match.winning_team === "a" && (
            <Trophy
              style={{ width: 14, height: 14, color: "var(--tl-gold)", flexShrink: 0 }}
            />
          )}
          <span>{teamALabel}</span>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <ScoreGames
            ours={match.team_a_score}
            theirs={match.team_b_score}
            highlight={
              match.winning_team === "a"
                ? "win"
                : match.winning_team === "b"
                  ? "lose"
                  : "tie"
            }
          />
          <ScoreGames
            ours={match.team_b_score}
            theirs={match.team_a_score}
            highlight={
              match.winning_team === "b"
                ? "win"
                : match.winning_team === "a"
                  ? "lose"
                  : "tie"
            }
          />
        </div>

        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 18,
            fontWeight: match.winning_team === "b" ? 500 : 400,
            color:
              match.winning_team === "b"
                ? "var(--tl-fg)"
                : "var(--tl-fg-2)",
            textAlign: "right",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
          }}
        >
          <span>{teamBLabel}</span>
          {match.winning_team === "b" && (
            <Trophy
              style={{ width: 14, height: 14, color: "var(--tl-gold)", flexShrink: 0 }}
            />
          )}
        </div>
      </div>

      {match.notes && (
        <p
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--tl-border)",
            fontSize: 13,
            color: "var(--tl-fg-3)",
            margin: "14px 0 0",
          }}
        >
          {match.notes}
        </p>
      )}

      {/* Organizer footer row: DUPR toggle / submit button / submitted info */}
      {(isOrganizer || match.submitted_to_dupr) && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--tl-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {match.submitted_to_dupr && match.dupr_match_id ? (
            <div style={monoLabelStyle}>
              DUPR ID ·{" "}
              <span style={{ color: "var(--tl-fg-2)" }}>
                {match.dupr_match_id}
              </span>
            </div>
          ) : match.confirmation_status === "pending_opponent_confirm" ? (
            <div
              style={{
                ...monoLabelStyle,
                color: "var(--tl-amber, #f59e0b)",
              }}
            >
              {lang === "vi"
                ? "Đang chờ đối thủ xác nhận tỉ số"
                : "Waiting for opponent to confirm the score"}
            </div>
          ) : match.confirmation_status === "confirmed" ? (
            <div
              style={{
                ...monoLabelStyle,
                color: "var(--tl-gold)",
              }}
            >
              {lang === "vi"
                ? "Đối thủ đã xác nhận — sẵn sàng gửi DUPR"
                : "Confirmed by opponent — ready to submit"}
            </div>
          ) : (
            <div
              style={{
                ...monoLabelStyle,
                color: match.ready_for_dupr ? "var(--tl-gold)" : "var(--tl-fg-4)",
              }}
            >
              {match.ready_for_dupr ? m.readyHint : m.draftHint}
            </div>
          )}

          {isOrganizer && !match.submitted_to_dupr && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {match.confirmation_status === "pending_opponent_confirm" ? (
                // Member-logged row: admin can't progress until opponent
                // confirms. Show explainer in lieu of the toggle.
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--tl-fg-3)",
                    fontStyle: "italic",
                  }}
                >
                  {lang === "vi"
                    ? "Đợi đối thủ xác nhận trước"
                    : "Awaiting opponent confirmation"}
                </span>
              ) : match.confirmation_status === "confirmed" ? (
                // Opponent confirmed — admin/organizer goes straight to
                // submit. No ready toggle (row is already ready).
                <button
                  type="button"
                  onClick={() => setSubmitOpen(true)}
                  className="tl-btn green"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  <UploadCloud style={{ width: 12, height: 12 }} />
                  {m.submit.openCta}
                </button>
              ) : (
                // auto_confirmed_admin path — existing draft → ready
                // toggle, then submit.
                <>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--tl-fg-2)",
                    }}
                  >
                    <span>{m.readyToggle}</span>
                    <input
                      type="checkbox"
                      checked={match.ready_for_dupr}
                      disabled={markReady.isPending}
                      onChange={(e) => void handleToggleReady(e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: "var(--tl-green)",
                        cursor: "pointer",
                      }}
                    />
                  </label>
                  {match.ready_for_dupr && (
                    <button
                      type="button"
                      onClick={() => setSubmitOpen(true)}
                      className="tl-btn green"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                    >
                      <UploadCloud style={{ width: 12, height: 12 }} />
                      {m.submit.openCta}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <SubmitDuprDialog
        match={match}
        clubId={clubId}
        open={submitOpen}
        onOpenChange={setSubmitOpen}
      />
    </article>
  );
}

export function ClubMatches({ clubId, isOrganizer }: Props) {
  const { t, language } = useI18n();
  const m = t.socialEvents.matches;
  const { matches, isLoading } = useClubMatches(clubId);
  const [logOpen, setLogOpen] = useState(false);

  const readyCount = matches.filter(
    (x) => x.ready_for_dupr && !x.submitted_to_dupr,
  ).length;

  return (
    <section style={{ marginBottom: 40 }}>
      {/* Section header — eyebrow + serif title + queue hint + log CTA */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div className="tl-eyebrow" style={{ marginBottom: 8 }}>
            <span className="pip" />
            <span>{m.sectionTitle.toUpperCase()}</span>
            {isOrganizer && readyCount > 0 && (
              <>
                <span className="sep">·</span>
                <span style={{ color: "var(--tl-gold)" }}>
                  {m.readyQueueHint.replace("{n}", String(readyCount))}
                </span>
              </>
            )}
          </div>
          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              margin: 0,
              color: "var(--tl-fg)",
            }}
          >
            {m.sectionTitle}.
          </h2>
        </div>

        {/* P2: members can also log matches — they go through the
            opponent-confirmation flow before reaching DUPR. Organizers
            still auto-confirm. log_club_match RPC enforces club-membership. */}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="tl-btn green"
          style={{ flexShrink: 0 }}
        >
          <Plus className="h-4 w-4" />
          {m.logCta}
        </button>
      </header>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "var(--tl-fg-3)" }}
          />
        </div>
      ) : matches.length === 0 ? (
        <p
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 17,
            color: "var(--tl-fg-3)",
            margin: 0,
          }}
        >
          {m.noMatches}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              isOrganizer={isOrganizer}
              clubId={clubId}
              lang={language}
            />
          ))}
        </div>
      )}

      <LogMatchDialog
        clubId={clubId}
        open={logOpen}
        onOpenChange={setLogOpen}
        isOrganizer={isOrganizer}
      />
    </section>
  );
}
