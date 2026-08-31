// ============================================================================
// WorldCupLiveCard — the compact World Cup strip at the very top of the home
// page during the tournament. One line: a LIVE badge, the most relevant live
// match (a Vietnamese player's if one is on court, with its score), the live
// count, and a link to /live. Repaints over Supabase Realtime.
//
// Deliberately small — it sits above everything else on the home page, so it
// states the one thing worth interrupting for (a match is live, Vietnam is
// playing) and links out, rather than reproducing the /live board. Self-hides
// when nothing is live or scheduled, and self-retires after Sep 7.
// ============================================================================

import { Link } from "react-router-dom";
import { useWcProLive, type WcProMatchRow } from "@/hooks/useWcProLive";
import { isVietnameseName } from "@/lib/wc-open/parse-pro";

const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
type Lang = "en" | "vi";

const sideIsVietnam = (name: string | null): boolean => isVietnameseName(name);

function featuredLine(m: WcProMatchRow) {
  const aVN = sideIsVietnam(m.entry_a_name);
  const bVN = sideIsVietnam(m.entry_b_name);
  const score =
    m.current_a != null && m.current_b != null
      ? `${m.current_a}-${m.current_b}`
      : (m.games_json ?? []).map((g) => `${g.a}-${g.b}`).join(", ");
  return (
    <span className="wclc-match">
      <span className={`wclc-side${aVN ? " wclc-side--vn" : ""}${m.leader_side === "A" ? " wclc-side--win" : ""}`}>
        {m.entry_a_name ?? "—"}
      </span>
      {score ? <span className="wclc-score">{score}</span> : <span className="wclc-vs">vs</span>}
      <span className={`wclc-side${bVN ? " wclc-side--vn" : ""}${m.leader_side === "B" ? " wclc-side--win" : ""}`}>
        {m.entry_b_name ?? "—"}
      </span>
    </span>
  );
}

export function WorldCupLiveCard({ language }: { language: Lang }) {
  const { data } = useWcProLive();

  if (Date.now() > HIDE_AFTER) return null;
  if (!data || data.events.length === 0) return null;

  const allLive = data.events.flatMap((e) => e.live);
  // Feature a Vietnamese player's live match if one is on court, else any live
  // match; if nothing is live, the card still points to what's coming.
  const featured =
    allLive.find((m) => sideIsVietnam(m.entry_a_name) || sideIsVietnam(m.entry_b_name)) ?? allLive[0] ?? null;
  const liveCount = data.liveCount;
  const href = language === "vi" ? "/vi/live" : "/live";

  return (
    <div className="tl-shell" style={{ marginTop: 12, marginBottom: 4 }}>
      <Link to={href} className="wclc" aria-label={language === "vi" ? "Xem World Cup trực tiếp" : "Watch the World Cup live"}>
        <style>{WCLC_CSS}</style>
        <span className="wclc-badge">
          {liveCount > 0 && <span className="wclc-dot" aria-hidden="true" />}
          {liveCount > 0 ? (language === "vi" ? "Trực tiếp" : "Live") : (language === "vi" ? "Đang diễn ra" : "On now")}
        </span>
        <span className="wclc-event">🏓 World Cup Đà Nẵng</span>
        <span className="wclc-body">
          {featured ? (
            featuredLine(featured)
          ) : (
            <span className="wclc-quiet">{language === "vi" ? "Cá nhân Pro & Đội tuyển" : "Pro & national teams"}</span>
          )}
        </span>
        {liveCount > 0 && (
          <span className="wclc-count">{liveCount} {language === "vi" ? "trận" : "live"}</span>
        )}
        <span className="wclc-cta">{language === "vi" ? "Xem" : "Watch"} →</span>
      </Link>
    </div>
  );
}

const WCLC_CSS = `
.wclc { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; text-decoration: none; color: var(--tl-fg); border: 1px solid var(--tl-border); border-left: 3px solid var(--tl-live); border-radius: var(--tl-radius, 10px); background: var(--tl-surface); padding: 11px 16px; transition: border-color .12s, background .12s; }
.wclc:hover { background: var(--tl-bg-elev); }
.wclc:focus-visible { outline: 2px solid var(--tl-gold); outline-offset: 2px; }
.wclc-badge { flex: none; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--tl-live); display: inline-flex; align-items: center; gap: 6px; }
.wclc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tl-live); animation: wclc-pulse 1.4s ease-in-out infinite; }
@keyframes wclc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .wclc-dot { animation: none; } }
.wclc-event { flex: none; font-weight: 800; font-size: 14px; color: var(--tl-fg); }
.wclc-body { flex: 1 1 auto; min-width: 0; font-size: 13.5px; color: var(--tl-dim); overflow: hidden; }
.wclc-match { display: inline-flex; align-items: baseline; gap: 8px; min-width: 0; }
.wclc-side { color: var(--tl-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw; }
.wclc-side--vn { color: var(--tl-live); }
.wclc-side--win { color: var(--tl-fg); font-weight: 700; }
.wclc-score { flex: none; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--tl-fg); }
.wclc-vs { flex: none; color: var(--tl-dim); font-size: 11px; }
.wclc-quiet { color: var(--tl-dim); }
.wclc-count { flex: none; font-size: 11px; font-weight: 700; color: #fff; background: var(--tl-live); border-radius: 999px; padding: 1px 8px; }
.wclc-cta { flex: none; margin-left: auto; font-size: 13px; font-weight: 700; color: var(--tl-gold); }
`;
