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

function StatusChip({
  status,
  m,
}: {
  status: "submitted" | "ready" | "draft";
  m: ReturnType<typeof useI18n>["t"]["socialEvents"]["matches"];
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

  const teamALabel = match.team_a_players
    .map((p) => p.display_name ?? "—")
    .join(" + ");
  const teamBLabel = match.team_b_players
    .map((p) => p.display_name ?? "—")
    .join(" + ");

  const status: "submitted" | "ready" | "draft" = match.submitted_to_dupr
    ? "submitted"
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
          <StatusChip status={status} m={m} />
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

      {/* Organizer footer row: DUPR toggle / submitted info */}
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
          )}
        </div>
      )}
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

        {isOrganizer && (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="tl-btn green"
            style={{ flexShrink: 0 }}
          >
            <Plus className="h-4 w-4" />
            {m.logCta}
          </button>
        )}
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
      />
    </section>
  );
}
