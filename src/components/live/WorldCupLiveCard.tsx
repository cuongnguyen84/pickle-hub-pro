// ============================================================================
// WorldCupLiveCard — the World Cup livescore card at the top of the home page
// during the tournament. A tournament-logo banner, a "Livescore" header with
// the live-match count, one or two matches in progress (score by score, a
// Vietnamese player's first), and a link to /live. Repaints over Supabase
// Realtime as scores change.
//
// Self-hides when nothing is live, and self-retires after Sep 7.
// ============================================================================

import { Link } from "react-router-dom";
import { useWcProLive, type WcProMatchRow } from "@/hooks/useWcProLive";
import { isVietnameseName } from "@/lib/wc-open/parse-pro";

const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
const LOGO = "/images/world-cup-2026-logo.jpg";
type Lang = "en" | "vi";

const sideIsVietnam = (name: string | null): boolean => isVietnameseName(name);

// The score to show against each side: the current game if in play, else the
// last finished game. One number per side, the way a scoreboard reads.
function sideScores(m: WcProMatchRow): { a: string; b: string } {
  if (m.current_a != null && m.current_b != null) {
    return { a: String(m.current_a), b: String(m.current_b) };
  }
  const last = (m.games_json ?? [])[(m.games_json ?? []).length - 1];
  return last ? { a: String(last.a), b: String(last.b) } : { a: "–", b: "–" };
}

function LiveMatch({ m }: { m: WcProMatchRow }) {
  const aVN = sideIsVietnam(m.entry_a_name);
  const bVN = sideIsVietnam(m.entry_b_name);
  const s = sideScores(m);
  return (
    <div className="wclc-m">
      <div className="wclc-m-round">{m.round_name ?? ""}</div>
      <div className={`wclc-m-row${m.leader_side === "A" ? " wclc-m-row--win" : ""}`}>
        <span className={`wclc-m-name${aVN ? " wclc-m-name--vn" : ""}`}>{m.entry_a_name ?? "—"}</span>
        <span className="wclc-m-score">{s.a}</span>
      </div>
      <div className={`wclc-m-row${m.leader_side === "B" ? " wclc-m-row--win" : ""}`}>
        <span className={`wclc-m-name${bVN ? " wclc-m-name--vn" : ""}`}>{m.entry_b_name ?? "—"}</span>
        <span className="wclc-m-score">{s.b}</span>
      </div>
    </div>
  );
}

export function WorldCupLiveCard({ language }: { language: Lang }) {
  const { data } = useWcProLive();

  if (Date.now() > HIDE_AFTER) return null;
  if (!data || data.events.length === 0) return null;

  const allLive = data.events.flatMap((e) => e.live);
  if (allLive.length === 0) return null; // the card exists to show live scores

  // Vietnamese matches first, then the rest; take up to two.
  const featured = [...allLive]
    .sort((x, y) => {
      const xv = sideIsVietnam(x.entry_a_name) || sideIsVietnam(x.entry_b_name) ? 0 : 1;
      const yv = sideIsVietnam(y.entry_a_name) || sideIsVietnam(y.entry_b_name) ? 0 : 1;
      return xv - yv;
    })
    .slice(0, 2);

  const href = language === "vi" ? "/vi/live" : "/live";
  const liveCount = data.liveCount;

  return (
    <div className="tl-shell" style={{ marginTop: 12, marginBottom: 8 }}>
      <div className="wclc">
        <style>{WCLC_CSS}</style>
        <Link to={href} className="wclc-banner" aria-label={language === "vi" ? "World Cup Đà Nẵng — xem trực tiếp" : "World Cup Da Nang — watch live"}>
          <img src={LOGO} alt="Heineken Pickleball World Cup 2026" loading="lazy" width={690} height={645} />
        </Link>
        <div className="wclc-content">
          <div className="wclc-header">
            <span className="wclc-title">Livescore</span>
            <span className="wclc-live"><span className="wclc-dot" aria-hidden="true" />{liveCount} {language === "vi" ? "trận đang đấu" : "live"}</span>
          </div>
          <div className="wclc-matches">
            {featured.map((m) => (
              <LiveMatch key={m.match_id} m={m} />
            ))}
          </div>
          <Link to={href} className="wclc-cta">
            {language === "vi" ? "Xem tất cả trận" : "See all matches"} →
          </Link>
        </div>
      </div>
    </div>
  );
}

const WCLC_CSS = `
.wclc { border: 1px solid var(--tl-border); border-radius: var(--tl-radius-lg, 14px); background: var(--tl-surface); overflow: hidden; }
.wclc-banner { display: block; line-height: 0; }
.wclc-banner img { width: 100%; height: 150px; object-fit: cover; object-position: center 42%; display: block; }
.wclc-content { padding: 16px 18px 18px; }
.wclc-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.wclc-title { font-family: inherit; font-size: 16px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-fg); }
.wclc-live { font-size: 12px; font-weight: 700; color: var(--tl-live); display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.wclc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tl-live); animation: wclc-pulse 1.4s ease-in-out infinite; }
@keyframes wclc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .wclc-dot { animation: none; } }
.wclc-matches { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.wclc-m { border: 1px solid var(--tl-border); border-left: 3px solid var(--tl-live); border-radius: var(--tl-radius, 10px); background: var(--tl-bg-elev); padding: 10px 13px; }
.wclc-m-round { font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); margin-bottom: 6px; }
.wclc-m-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 2px 0; color: var(--tl-dim); font-size: 14.5px; }
.wclc-m-row--win { color: var(--tl-fg); font-weight: 700; }
.wclc-m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.wclc-m-name--vn { color: var(--tl-live); }
.wclc-m-score { flex: none; font-variant-numeric: tabular-nums; font-weight: 800; font-size: 16px; color: var(--tl-fg); }
.wclc-cta { display: inline-block; margin-top: 14px; font-size: 13.5px; font-weight: 700; color: var(--tl-gold); text-decoration: none; }
.wclc-cta:hover { text-decoration: underline; }
`;
