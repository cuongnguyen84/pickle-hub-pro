// ============================================================================
// WorldCupLiveCard — the World Cup card at the top of the home page during the
// tournament. Two modes over the same shell (logo + header + up to a few match
// cards + a link to /live), repainting over Supabase Realtime:
//   * live now → "Livescore": one or two matches in progress, score by score,
//     a Vietnamese player's first.
//   * nothing live → "Kết quả hôm nay": today's finished Vietnamese matches
//     with their full scorelines (winner in bold).
//
// Shows nothing when there is neither a live match nor a result today, and
// self-retires after Sep 7.
// ============================================================================

import { Link } from "react-router-dom";
import { useWcProLive, type WcProMatchRow } from "@/hooks/useWcProLive";
import { isVietnameseName } from "@/lib/wc-open/parse-pro";
import { scoreLine } from "./wc-score";

const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
const LOGO = "/images/world-cup-2026-logo.jpg";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
type Lang = "en" | "vi";

const sideIsVietnam = (name: string | null): boolean => isVietnameseName(name);

/** The Vietnam-local calendar date (YYYY-MM-DD) of an instant. */
function vnDay(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}
/** Was this match played today, Vietnam time? Uses its scheduled slot. */
function isToday(m: WcProMatchRow): boolean {
  if (!m.scheduled_at) return false;
  const t = Date.parse(m.scheduled_at);
  return !Number.isNaN(t) && vnDay(t) === vnDay(Date.now());
}

// The score to show against each side of a LIVE match: the current game if in
// play, else the last finished game. One number per side, scoreboard-style.
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

// A finished match. Colour carries one meaning only: who won. The winner is
// bold in the foreground with a check; the loser is dimmed. (No Vietnam-red
// here — every match on this card has a Vietnamese player, so red would mark
// nearly every name and tell the reader nothing about the result.)
function ResultMatch({ m }: { m: WcProMatchRow }) {
  const line = scoreLine(m);
  const aWon = m.leader_side === "A";
  const bWon = m.leader_side === "B";
  return (
    <div className="wclc-r">
      <div className="wclc-r-round">{m.round_name ?? ""}</div>
      <div className={`wclc-r-row${aWon ? " wclc-r-row--win" : ""}`}>
        {aWon && <span className="wclc-r-tick" aria-hidden="true">✓</span>}
        <span className="wclc-r-name">{m.entry_a_name ?? "—"}</span>
      </div>
      <div className={`wclc-r-row${bWon ? " wclc-r-row--win" : ""}`}>
        {bWon && <span className="wclc-r-tick" aria-hidden="true">✓</span>}
        <span className="wclc-r-name">{m.entry_b_name ?? "—"}</span>
      </div>
      {line && <div className="wclc-r-line">{line}</div>}
    </div>
  );
}

export function WorldCupLiveCard({ language }: { language: Lang }) {
  const { data } = useWcProLive();

  if (Date.now() > HIDE_AFTER) return null;
  if (!data || data.events.length === 0) return null;

  const isVn = (m: WcProMatchRow) => sideIsVietnam(m.entry_a_name) || sideIsVietnam(m.entry_b_name);

  const allLive = data.events.flatMap((e) => e.live);
  // Today's finished Vietnamese matches, latest first — the fallback when
  // nothing is live so the card stays useful between sessions.
  const todayResults = data.events
    .flatMap((e) => e.vietnam)
    .filter((m) => m.status === "completed" && isToday(m))
    .sort((x, y) => (y.scheduled_at ?? "").localeCompare(x.scheduled_at ?? ""));

  const live = allLive.length > 0;
  if (!live && todayResults.length === 0) return null; // nothing live, no result today

  const featured = live
    ? [...allLive].sort((x, y) => (isVn(x) ? 0 : 1) - (isVn(y) ? 0 : 1)).slice(0, 2)
    : todayResults.slice(0, 2);

  const href = language === "vi" ? "/vi/live" : "/live";

  return (
    <div className="tl-shell" style={{ marginTop: 44, marginBottom: 8 }}>
      <div className="wclc">
        <style>{WCLC_CSS}</style>
        <div className="wclc-content">
          <div className="wclc-header">
            <Link to={href} className="wclc-logo" aria-label={language === "vi" ? "Pickleball World Cup Đà Nẵng — xem trực tiếp" : "Pickleball World Cup Da Nang — watch live"}>
              <img src={LOGO} alt="Heineken Pickleball World Cup 2026" loading="lazy" width={690} height={645} />
            </Link>
            <div className="wclc-head-text">
              {live ? (
                <>
                  <span className="wclc-title">Livescore</span>
                  <span className="wclc-live"><span className="wclc-dot" aria-hidden="true" />{data.liveCount} {language === "vi" ? "trận đang đấu" : "live"}</span>
                </>
              ) : (
                <>
                  <span className="wclc-title">{language === "vi" ? "Kết quả hôm nay" : "Today's results"}</span>
                  <span className="wclc-sub">{language === "vi" ? `${todayResults.length} trận Việt Nam` : `${todayResults.length} Vietnam ${todayResults.length === 1 ? "match" : "matches"}`}</span>
                </>
              )}
            </div>
          </div>
          <div className="wclc-matches">
            {featured.map((m) =>
              live ? <LiveMatch key={m.match_id} m={m} /> : <ResultMatch key={m.match_id} m={m} />,
            )}
          </div>
          <Link to={href} className="wclc-cta">
            {live
              ? language === "vi" ? "Xem tất cả trận" : "See all matches"
              : language === "vi" ? "Xem tất cả kết quả" : "See all results"} →
          </Link>
        </div>
      </div>
    </div>
  );
}

const WCLC_CSS = `
.wclc { border: 1px solid var(--tl-border); border-radius: var(--tl-radius-lg, 14px); background: var(--tl-surface); overflow: hidden; }
.wclc-content { padding: 12px 14px 13px; }
.wclc-header { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; }
.wclc-logo { flex: none; display: block; width: 46px; height: 46px; border-radius: 10px; overflow: hidden; line-height: 0; border: 1px solid var(--tl-border); }
.wclc-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wclc-head-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wclc-title { font-family: inherit; font-size: 15.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-fg); line-height: 1.1; }
.wclc-live { font-size: 12px; font-weight: 700; color: var(--tl-live); display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.wclc-sub { font-size: 12px; font-weight: 700; color: var(--tl-dim); white-space: nowrap; }
.wclc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tl-live); animation: wclc-pulse 1.4s ease-in-out infinite; }
@keyframes wclc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .wclc-dot { animation: none; } }
.wclc-matches { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
.wclc-m { border: 1px solid var(--tl-border); border-left: 3px solid var(--tl-live); border-radius: var(--tl-radius, 10px); background: var(--tl-bg-elev); padding: 10px 13px; }
/* Result card (compact): win/loss is the only signal. */
.wclc-r { border: 1px solid var(--tl-border); border-radius: var(--tl-radius, 10px); background: var(--tl-bg-elev); padding: 8px 11px; }
.wclc-r-round { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); margin-bottom: 4px; }
.wclc-r-row { display: flex; align-items: baseline; gap: 6px; padding: 1px 0; color: var(--tl-dim); font-size: 14px; min-width: 0; }
.wclc-r-row--win { color: var(--tl-fg); font-weight: 700; }
.wclc-r-tick { flex: none; color: var(--tl-gold); font-size: 11px; font-weight: 700; }
.wclc-r-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.wclc-r-line { margin-top: 5px; font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--tl-dim); letter-spacing: .02em; }
.wclc-m-round { font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); margin-bottom: 6px; }
.wclc-m-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 2px 0; color: var(--tl-dim); font-size: 14.5px; }
.wclc-m-row--win { color: var(--tl-fg); font-weight: 700; }
.wclc-m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.wclc-m-name--vn { color: var(--tl-live); }
.wclc-m-score { flex: none; font-variant-numeric: tabular-nums; font-weight: 800; font-size: 16px; color: var(--tl-fg); }
.wclc-cta { display: inline-block; margin-top: 11px; font-size: 13px; font-weight: 700; color: var(--tl-gold); text-decoration: none; }
.wclc-cta:hover { text-decoration: underline; }
`;
