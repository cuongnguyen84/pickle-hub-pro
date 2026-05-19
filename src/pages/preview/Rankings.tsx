import { useState } from "react";
import { Link } from "react-router-dom";
import { PreviewShell } from "./_shell";

/* ---------------------------------------------------------------------------
 * DUPR-style rankings preview.
 *
 * NOTE: DUPR data is publicly available. This preview uses a curated
 * snapshot of approximate 2026 top ratings for layout evaluation. In
 * production this should connect to DUPR's public profile/leaderboard
 * endpoints via a Supabase edge function (cached hourly to avoid
 * hammering their API).
 * ------------------------------------------------------------------------- */

interface Player {
  rank: number;
  move: "up" | "down" | "flat";
  moveAmount?: number;
  name: string;
  country: string;
  dupr: number;
  form: ("W" | "L")[]; // last 5
  club?: string;
}

const MEN_SINGLES: Player[] = [
  { rank: 1, move: "flat", name: "Ben Johns", country: "USA", dupr: 7.00, form: ["W", "W", "W", "W", "W"], club: "Team Johns" },
  { rank: 2, move: "up", moveAmount: 1, name: "Federico Staksrud", country: "ARG", dupr: 6.42, form: ["W", "W", "L", "W", "W"], club: "Independent" },
  { rank: 3, move: "down", moveAmount: 1, name: "Tyson McGuffin", country: "USA", dupr: 6.38, form: ["L", "W", "W", "L", "W"], club: "Selkirk" },
  { rank: 4, move: "flat", name: "JW Johnson", country: "USA", dupr: 6.29, form: ["W", "W", "W", "L", "W"], club: "Team Johnson" },
  { rank: 5, move: "up", moveAmount: 2, name: "Connor Garnett", country: "USA", dupr: 6.24, form: ["W", "W", "W", "W", "L"], club: "Joola" },
  { rank: 6, move: "up", moveAmount: 3, name: "Quang Duong", country: "VNM", dupr: 6.18, form: ["W", "W", "W", "W", "W"], club: "Sai Gon PC" },
  { rank: 7, move: "down", moveAmount: 2, name: "Dylan Frazier", country: "USA", dupr: 6.15, form: ["L", "W", "L", "W", "W"], club: "Six Zero" },
  { rank: 8, move: "flat", name: "Thomas Wilson", country: "USA", dupr: 6.08, form: ["W", "L", "W", "W", "W"], club: "Franklin" },
  { rank: 9, move: "down", moveAmount: 2, name: "Pablo Tellez", country: "COL", dupr: 6.04, form: ["L", "L", "W", "W", "W"], club: "Engage" },
  { rank: 10, move: "up", moveAmount: 1, name: "Christian Alshon", country: "USA", dupr: 5.98, form: ["W", "W", "W", "L", "W"], club: "Gearbox" },
  { rank: 11, move: "down", moveAmount: 1, name: "Collin Johns", country: "USA", dupr: 5.92, form: ["W", "L", "L", "W", "W"], club: "Team Johns" },
  { rank: 12, move: "flat", name: "Gabriel Tardio", country: "BOL", dupr: 5.88, form: ["W", "W", "W", "L", "L"], club: "Independent" },
  { rank: 13, move: "up", moveAmount: 2, name: "Hunter Johnson", country: "USA", dupr: 5.82, form: ["W", "W", "L", "W", "W"], club: "CRBN" },
  { rank: 14, move: "down", moveAmount: 1, name: "Andrei Daescu", country: "ROU", dupr: 5.78, form: ["L", "W", "W", "W", "L"], club: "Independent" },
  { rank: 15, move: "flat", name: "Riley Newman", country: "USA", dupr: 5.75, form: ["W", "L", "W", "L", "W"], club: "CRBN" },
];

const WOMEN_SINGLES: Player[] = [
  { rank: 1, move: "flat", name: "Anna Leigh Waters", country: "USA", dupr: 6.18, form: ["W", "W", "W", "W", "W"], club: "Team Waters" },
  { rank: 2, move: "up", moveAmount: 1, name: "Anna Bright", country: "USA", dupr: 5.92, form: ["W", "W", "W", "L", "W"], club: "Joola" },
  { rank: 3, move: "down", moveAmount: 1, name: "Catherine Parenteau", country: "CAN", dupr: 5.88, form: ["L", "W", "W", "W", "L"], club: "Selkirk" },
  { rank: 4, move: "up", moveAmount: 2, name: "Jorja Johnson", country: "USA", dupr: 5.75, form: ["W", "W", "L", "W", "W"], club: "Team Johnson" },
  { rank: 5, move: "down", moveAmount: 1, name: "Parris Todd", country: "USA", dupr: 5.65, form: ["L", "W", "W", "L", "W"], club: "Independent" },
  { rank: 6, move: "flat", name: "Lea Jansen", country: "USA", dupr: 5.58, form: ["W", "L", "W", "W", "L"], club: "Franklin" },
  { rank: 7, move: "up", moveAmount: 3, name: "Salome Devidze", country: "GEO", dupr: 5.52, form: ["W", "W", "W", "W", "L"], club: "Independent" },
  { rank: 8, move: "down", moveAmount: 2, name: "Andrea Koop", country: "USA", dupr: 5.48, form: ["L", "L", "W", "W", "W"], club: "Six Zero" },
  { rank: 9, move: "flat", name: "Vivienne David", country: "USA", dupr: 5.42, form: ["W", "W", "L", "L", "W"], club: "Engage" },
  { rank: 10, move: "up", moveAmount: 1, name: "Simone Jardim", country: "BRA/USA", dupr: 5.38, form: ["W", "L", "W", "W", "L"], club: "Joola" },
  { rank: 11, move: "down", moveAmount: 1, name: "Callie Smith", country: "USA", dupr: 5.32, form: ["L", "W", "W", "L", "W"], club: "Selkirk" },
  { rank: 12, move: "up", moveAmount: 4, name: "Hurricane Black", country: "USA", dupr: 5.25, form: ["W", "W", "W", "W", "W"], club: "Independent" },
  { rank: 13, move: "flat", name: "Etta Wright", country: "USA", dupr: 5.20, form: ["W", "L", "W", "L", "W"], club: "Franklin" },
  { rank: 14, move: "down", moveAmount: 2, name: "Mary Brascia", country: "USA", dupr: 5.16, form: ["L", "W", "L", "W", "W"], club: "Independent" },
  { rank: 15, move: "up", moveAmount: 1, name: "Thu Ha Nguyen", country: "VNM", dupr: 5.08, form: ["W", "W", "W", "L", "W"], club: "Ha Noi PC" },
];

const MIXED_DOUBLES: Player[] = [
  { rank: 1, move: "flat", name: "Anna Leigh Waters", country: "USA", dupr: 6.45, form: ["W", "W", "W", "W", "W"], club: "w/ B. Johns" },
  { rank: 2, move: "flat", name: "Ben Johns", country: "USA", dupr: 6.42, form: ["W", "W", "W", "W", "W"], club: "w/ A.L. Waters" },
  { rank: 3, move: "up", moveAmount: 1, name: "Catherine Parenteau", country: "CAN", dupr: 6.08, form: ["W", "W", "L", "W", "W"], club: "w/ R. Newman" },
  { rank: 4, move: "down", moveAmount: 1, name: "JW Johnson", country: "USA", dupr: 6.02, form: ["W", "L", "W", "W", "L"], club: "w/ J. Johnson" },
  { rank: 5, move: "up", moveAmount: 2, name: "Jorja Johnson", country: "USA", dupr: 5.98, form: ["W", "W", "W", "W", "L"], club: "w/ JW Johnson" },
  { rank: 6, move: "flat", name: "Riley Newman", country: "USA", dupr: 5.92, form: ["W", "W", "L", "W", "W"], club: "w/ C. Parenteau" },
  { rank: 7, move: "down", moveAmount: 2, name: "Anna Bright", country: "USA", dupr: 5.85, form: ["L", "W", "W", "L", "W"], club: "w/ J. Kovalova" },
  { rank: 8, move: "up", moveAmount: 1, name: "Jessie Irvine", country: "USA", dupr: 5.78, form: ["W", "W", "W", "L", "W"], club: "w/ D. Patriquin" },
  { rank: 9, move: "down", moveAmount: 1, name: "Matt Wright", country: "USA", dupr: 5.72, form: ["W", "L", "W", "W", "L"], club: "w/ L. Jansen" },
  { rank: 10, move: "flat", name: "Lea Jansen", country: "USA", dupr: 5.68, form: ["L", "W", "L", "W", "W"], club: "w/ M. Wright" },
];

type Category = "men-singles" | "women-singles" | "mixed";

const DATASETS: Record<Category, Player[]> = {
  "men-singles": MEN_SINGLES,
  "women-singles": WOMEN_SINGLES,
  "mixed": MIXED_DOUBLES,
};

const Rankings = () => {
  const [category, setCategory] = useState<Category>("men-singles");
  const players = DATASETS[category];

  return (
    <PreviewShell title="Rankings · Preview" active="rankings">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/preview/the-line">Home</Link>
          <span className="sep">/</span>
          <span className="current">Rankings</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">◆ DUPR · Global · Week 16 of 2026</div>
          <h1>
            Where <em className="tl-serif">everyone</em> <br />
            <span className="dim">actually</span> <span className="sans">stands.</span>
          </h1>
          <p>
            DUPR (Dynamic Universal Pickleball Rating) is the global standard.
            Rankings update weekly based on match results from sanctioned events.
            Data syncs from DUPR's public profile feed — refreshed every hour.
          </p>
        </header>

        <div className="tl-filters">
          {([
            { key: "men-singles" as const, label: "Men's Singles" },
            { key: "women-singles" as const, label: "Women's Singles" },
            { key: "mixed" as const, label: "Mixed Doubles" },
          ]).map((c) => (
            <button
              key={c.key}
              type="button"
              className={`tl-filter ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
              <span className="count">{DATASETS[c.key].length}</span>
            </button>
          ))}
        </div>

        <div className="tl-panel" style={{ marginBottom: 48 }}>
          <div className="tl-panel-head">
            <h3>
              {category === "men-singles" && "Men's Singles · Top 15"}
              {category === "women-singles" && "Women's Singles · Top 15"}
              {category === "mixed" && "Mixed Doubles · Top 10"}
            </h3>
            <span className="meta">Updated 18m ago · Source: DUPR</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tl-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="hide-mobile">Club / Partner</th>
                  <th className="hide-mobile">Form</th>
                  <th>DUPR</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={`${category}-${p.rank}`}>
                    <td className="tl-rank-pos">
                      {p.rank.toString().padStart(2, "0")}
                      <span className={`move ${p.move}`}>
                        {p.move === "up" && `▲${p.moveAmount}`}
                        {p.move === "down" && `▼${p.moveAmount}`}
                        {p.move === "flat" && "–"}
                      </span>
                    </td>
                    <td>
                      <div className="tl-rank-name">
                        <span>{p.name}</span>
                        <span className="tl-rank-flag">{p.country}</span>
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ color: "var(--tl-fg-3)", fontFamily: "Geist Mono", fontSize: 12 }}>
                      {p.club ?? "—"}
                    </td>
                    <td className="hide-mobile">
                      <div className="tl-rank-form">
                        {p.form.map((r, i) => (
                          <span key={i} className={r.toLowerCase() as "w" | "l"}>{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="tl-rank-score">{p.dupr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footnote */}
        <div
          className="tl-mono"
          style={{
            padding: "20px 24px",
            background: "var(--tl-surface)",
            border: "1px solid var(--tl-border)",
            borderRadius: "var(--tl-radius-lg)",
            fontSize: 12,
            color: "var(--tl-fg-3)",
            letterSpacing: "-0.005em",
            lineHeight: 1.6,
            marginBottom: 80,
            fontFamily: "Geist",
          }}
        >
          <strong style={{ color: "var(--tl-fg-2)", display: "block", marginBottom: 8, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "Geist Mono", fontWeight: 500 }}>
            ◆ About this data
          </strong>
          DUPR ratings above are a curated snapshot for design preview.
          In production, this page will sync hourly from DUPR's public profile
          API via a Supabase edge function, with caching in Postgres to stay
          within rate limits. Per-player detail pages will show full match
          history, tournament breakdowns, and head-to-head records.
        </div>
      </div>
    </PreviewShell>
  );
};

export default Rankings;
