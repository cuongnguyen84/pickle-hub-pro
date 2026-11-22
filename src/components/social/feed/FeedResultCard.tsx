import { Link } from "react-router-dom";
import {
  type Language,
  type FeedParticipant,
  formatMatchWhen,
  groupTeams,
  buildAriaLabel,
} from "@/lib/social/feed-formatters";
import { feedResultLabels } from "@/lib/social/feed-ranking";
import type { FeedTimelineItem } from "@/hooks/social/useFeedTimeline";

type FeedResultItem = Extract<FeedTimelineItem, { type: "result" }>;

interface FeedResultCardProps {
  item: FeedResultItem;
  language: Language;
  staggerIndex?: number;
}

/**
 * Finished final from a pro/community match stream, a Quick Table, a
 * doubles-elimination tournament, or a team match. The whole card opens
 * the page that already shows that result.
 */
export function FeedResultCard({ item, language, staggerIndex }: FeedResultCardProps) {
  const { teamA, teamB } = groupTeams(item.participants);
  const winnerIsA = item.winning_team === "a";
  const winnerIsB = item.winning_team === "b";
  const labels = feedResultLabels({
    source: item.source_provider,
    roundName: item.round_name,
    division: item.division,
    language,
  });
  const ariaLabel = buildAriaLabel({
    language,
    teamA,
    teamB,
    scoreA: item.team_a_score,
    scoreB: item.team_b_score,
    winningTeam: winnerIsA ? "a" : winnerIsB ? "b" : null,
    venueName: item.venue_name,
    playedAt: item.published_at,
    format: item.format,
  });
  const animDelay =
    staggerIndex != null && staggerIndex >= 0 && staggerIndex < 6
      ? `${staggerIndex * 80}ms`
      : "0ms";
  const caption = [item.tournament_name, labels.division].filter(Boolean).join(" · ");

  return (
    <article
      className="tl-feed-card tl-feed-card--final"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 18,
        padding: "32px 0",
        borderBottom: "1px solid var(--tl-border)",
        color: "inherit",
        cursor: "pointer",
        position: "relative",
        opacity: 0,
        transform: "translateY(8px)",
        animation: `tl-feed-card-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${animDelay} forwards`,
      }}
    >
      <Link
        to={item.href}
        aria-label={ariaLabel}
        className="tl-feed-card-link"
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--tl-fg-3)",
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--tl-fg-3)" }}
          />
          <span style={{ color: "var(--tl-fg-2)" }}>
            {formatMatchWhen(item.published_at, language, "desktop")}
          </span>
          <span style={{ color: "var(--tl-fg-4)" }}>·</span>
          <span>{labels.kind}</span>
        </div>
        {labels.round ? (
          <span className="tl-feed-final-badge" aria-label={labels.round}>
            {labels.round}
          </span>
        ) : null}
      </div>

      {caption ? (
        <div
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "var(--tl-fg-3)",
            textTransform: "uppercase",
            marginTop: -8,
          }}
        >
          {caption}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "8px 24px",
          padding: "4px 0",
        }}
      >
        <SideNames team={teamA} isWinner={winnerIsA} />
        <ScoreText scores={item.team_a_score} isWinner={winnerIsA} />
        <SideNames team={teamB} isWinner={winnerIsB} />
        <ScoreText scores={item.team_b_score} isWinner={winnerIsB} />
      </div>

      <div className="tl-feed-card-foot">
        <span className="tl-feed-final-champion" aria-hidden="true">
          {language === "vi" ? "Đăng quang" : "Champion"}
        </span>
        {item.venue_name ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--tl-fg-2)",
            }}
          >
            <span aria-hidden="true" style={{ color: "var(--tl-fg-4)", fontSize: 8 }}>
              ◆
            </span>
            {item.venue_name}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function SideNames({ team, isWinner }: { team: FeedParticipant[]; isWinner: boolean }) {
  if (team.length === 0) return <div />;
  return (
    <div style={{ padding: "8px 0", opacity: isWinner ? 1 : 0.55 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        {team.map((player, index) => (
          <span key={`${player.player_id}:${player.position ?? index}`} style={{ display: "inline-flex", gap: 10 }}>
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 26,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: "var(--tl-fg)",
                fontStyle: isWinner ? "italic" : "normal",
              }}
            >
              {player.display_name ?? player.username ?? "—"}
            </span>
            {index < team.length - 1 ? (
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: "italic",
                  fontSize: 22,
                  color: "var(--tl-fg-4)",
                }}
              >
                +
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreText({ scores, isWinner }: { scores: number[]; isWinner: boolean }) {
  return (
    <div
      style={{
        fontFamily: "'Instrument Serif', serif",
        fontStyle: "italic",
        fontSize: 28,
        lineHeight: 1,
        color: isWinner ? "var(--tl-fg)" : "var(--tl-fg-3)",
        textAlign: "right",
        padding: "8px 0",
      }}
    >
      {scores.length > 0 ? scores.join(" ") : "–"}
    </div>
  );
}
