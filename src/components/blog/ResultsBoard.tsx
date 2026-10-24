import { useMemo, useState } from "react";
import type {
  BlogSection,
  ResultsBoard as ResultsBoardData,
  ResultsSummaryDraw,
} from "@/content/blog/types";

/**
 * Structured tournament results for blog results posts (Hong Kong Slam and
 * every later autopublished event). Data comes from the post file itself —
 * the generator (scripts/blog/tournament_results_autopublish.py) emits
 * `resultsBoard` per draw section and `resultsSummary` on the intro section
 * from the official feed, so this component only presents facts, it never
 * re-derives a score. The bot path renders the same structure statically in
 * functions/_lib/render/blog-body.ts with the same tl-rb-* classes.
 */

/** In-page anchor id for a draw — same slug rule as the generator's
 *  `_anchor` (đ→d first: it has no NFKD decomposition). */
export function resultsAnchor(division: string): string {
  const slug = division
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/['’]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `rb-${slug}`;
}

export function ResultsSummary({ draws }: { draws: ResultsSummaryDraw[] }) {
  if (!draws.length) return null;
  return (
    <div className="tl-rb-summary">
      <h3>Tournament summary</h3>
      {draws.map((d) => (
        <div className="tl-rb-srow" key={d.anchor}>
          <span className="tl-rb-sdiv">{d.division}</span>
          <span className="tl-rb-sval">
            {d.champion ?? "No champion yet"}
            <small>{d.note}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: ResultsBoardData["rounds"][number]["matches"][number] }) {
  if (match.teamA) {
    // Fixture: not played yet — two neutral team lines, no winner styling,
    // no score. Never render a fixture with the result layout.
    return (
      <div className="tl-rb-match">
        <div className="tl-rb-teams">
          <div className="tl-rb-team">{match.teamA}</div>
          <div className="tl-rb-team">{match.teamB}</div>
        </div>
        <div className="tl-rb-sets" />
      </div>
    );
  }
  return (
    <div className="tl-rb-match">
      <div className="tl-rb-teams">
        <div className="tl-rb-win">{match.winner}</div>
        <div className="tl-rb-lose">{match.loser}</div>
        {match.status && <div className="tl-rb-status">{match.status}</div>}
      </div>
      <div className="tl-rb-sets">
        {match.sets.map(([w, l], i) => (
          <span key={i}>
            {i > 0 && " · "}
            <strong>{w}</strong>-{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function DrawBoard({
  board,
  query,
}: {
  board: ResultsBoardData;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const rounds = board.rounds
    .map((r) => ({
      ...r,
      matches: q
        ? r.matches.filter(
            (m) =>
              (m.winner ?? m.teamA ?? "").toLowerCase().includes(q) ||
              (m.loser ?? m.teamB ?? "").toLowerCase().includes(q),
          )
        : r.matches,
    }))
    .filter((r) => r.matches.length > 0);
  if (!rounds.length) return null;
  return (
    <>
      {rounds.map((r) =>
        r.collapsed && !q ? (
          <details className="tl-rb-details" key={r.label}>
            <summary>
              {r.label} — {r.matches.length}{" "}
              {r.matches.length === 1 ? "match" : "matches"}
            </summary>
            {r.matches.map((m, i) => (
              <MatchRow key={i} match={m} />
            ))}
          </details>
        ) : (
          <div key={r.label}>
            <h3 className="tl-rb-round">{r.label}</h3>
            {r.matches.map((m, i) => (
              <MatchRow key={i} match={m} />
            ))}
          </div>
        ),
      )}
    </>
  );
}

/**
 * The hub replaces the per-section rendering of every resultsBoard section:
 * sticky draw chips + player search on top, then each draw in place. It is
 * mounted once, at the position of the first board section (draw sections
 * are consecutive in generated posts).
 */
export function ResultsHub({ sections }: { sections: BlogSection[] }) {
  const [query, setQuery] = useState("");
  const boards = useMemo(
    () =>
      sections
        .filter((s) => s.resultsBoard)
        .map((s) => ({
          heading: s.heading,
          content: s.content,
          board: s.resultsBoard!,
        })),
    [sections],
  );
  if (!boards.length) return null;
  return (
    <>
      <div className="tl-rb-sticky">
        <div className="tl-rb-chips">
          {boards.map(({ board }) => (
            <a
              className="tl-rb-chip"
              key={board.division}
              href={`#${resultsAnchor(board.division)}`}
            >
              {board.division}
            </a>
          ))}
        </div>
        <input
          className="tl-rb-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by player name…"
          aria-label="Search results by player name"
        />
      </div>
      {boards.map(({ heading, content, board }) => (
        <section key={board.division} id={resultsAnchor(board.division)}>
          <h2>{heading}</h2>
          {content && <p className="tl-rb-drawsub">{content}</p>}
          <DrawBoard board={board} query={query} />
        </section>
      ))}
    </>
  );
}
