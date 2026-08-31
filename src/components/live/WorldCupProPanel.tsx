// ============================================================================
// WorldCupProContent — the OPEN/Pro individual events, as one tab of the World
// Cup live board (see WorldCupLiveBoard). Presentational: it takes an already
// fetched WcProFeed and renders a sub-tab per event (men's/women's singles,
// men's/women's doubles, mixed); the selected event shows its in-progress
// matches with live scores plus every Vietnamese match, VN highlighted, the
// leading side bold. The container owns the hook, header and level-1 tabs.
//
// Scoped `wcpro-` styles on TheLine's --tl-* tokens.
// ============================================================================

import { useMemo, useState } from "react";
import { PRO_EVENT_ORDER, type ProEvent, type WcProFeed, type WcProMatchRow } from "@/hooks/useWcProLive";
import { isVietnameseName } from "@/lib/wc-open/parse-pro";

type Lang = "en" | "vi";

const EVENT_LABEL: Record<ProEvent, { vi: string; en: string }> = {
  pro_singles_mens: { vi: "Đơn nam", en: "Men's Singles" },
  pro_singles_womens: { vi: "Đơn nữ", en: "Women's Singles" },
  pro_doubles_mens: { vi: "Đôi nam", en: "Men's Doubles" },
  pro_doubles_womens: { vi: "Đôi nữ", en: "Women's Doubles" },
  pro_mixed: { vi: "Đôi nam nữ", en: "Mixed Doubles" },
};

// Which side of a match is the Vietnamese one, so only that name lights up (a
// VN-vs-VN match lights both). Uses the parser's detection — one source of truth.
const sideIsVietnam = (name: string | null): boolean => isVietnameseName(name);

// The full scoreline: every finished game, plus the last game still in view.
// For a live match that trailing game is the one being played. For a completed
// match it's the last game we observed before the source dropped it — the
// source never server-renders a completed match's final, so a finished bo3 is
// shown as "game1, game2, <last-seen decider>" rather than losing the decider,
// and a single-game knockout that only ever had a current game (empty games_json)
// still shows its last-recorded score instead of rendering blank.
function scoreLine(m: WcProMatchRow): string {
  const games = m.games_json ?? [];
  const parts = games.map((g) => `${g.a}-${g.b}`);
  if ((m.status === "in_progress" || m.status === "completed") && m.current_a != null && m.current_b != null) {
    const last = games[games.length - 1];
    const dupOfLast = last != null && last.a === m.current_a && last.b === m.current_b;
    // A live match at 0-0 is the game just starting — keep it. On a completed
    // match a trailing 0-0 is noise (the source zeroed the game as it dropped it).
    const emptyOnDone = m.status === "completed" && m.current_a === 0 && m.current_b === 0;
    if (!dupOfLast && !emptyOnDone) parts.push(`${m.current_a}-${m.current_b}`);
  }
  return parts.join(", ");
}

function MatchRow({ m, lang }: { m: WcProMatchRow; lang: Lang }) {
  const aVN = sideIsVietnam(m.entry_a_name);
  const bVN = sideIsVietnam(m.entry_b_name);
  const line = scoreLine(m);
  const isLive = m.status === "in_progress";
  return (
    <div className={`wcpro-match${isLive ? " wcpro-match--live" : ""}`}>
      <div className="wcpro-match-head">
        <span className="wcpro-round">{m.round_name ?? ""}</span>
        {isLive ? (
          <span className="wcpro-live-tag"><span className="wcpro-dot" aria-hidden="true" />{lang === "vi" ? "Trực tiếp" : "Live"}</span>
        ) : m.status === "completed" ? (
          <span className="wcpro-done-tag">{lang === "vi" ? "Kết thúc" : "Final"}</span>
        ) : (
          <span className="wcpro-sched">{m.court_label ?? (lang === "vi" ? "Sắp đấu" : "Upcoming")}</span>
        )}
      </div>
      <div className={`wcpro-row${m.leader_side === "A" ? " wcpro-row--win" : ""}`}>
        <span className={`wcpro-name${aVN ? " wcpro-name--vn" : ""}`}>
          {m.entry_a_seed != null && <span className="wcpro-seed">#{m.entry_a_seed}</span>}
          {m.entry_a_name ?? "—"}
          {m.serving_side === "A" && isLive && <span className="wcpro-serve" aria-hidden="true">•</span>}
        </span>
      </div>
      <div className={`wcpro-row${m.leader_side === "B" ? " wcpro-row--win" : ""}`}>
        <span className={`wcpro-name${bVN ? " wcpro-name--vn" : ""}`}>
          {m.entry_b_seed != null && <span className="wcpro-seed">#{m.entry_b_seed}</span>}
          {m.entry_b_name ?? "—"}
          {m.serving_side === "B" && isLive && <span className="wcpro-serve" aria-hidden="true">•</span>}
        </span>
      </div>
      {line && <div className="wcpro-score">{line}</div>}
    </div>
  );
}

export function WorldCupProContent({ feed, language }: { feed: WcProFeed; language: Lang }) {
  // Events that actually have matches, in the canonical singles→doubles→mixed
  // order. Only these get a sub-tab.
  const events = useMemo(
    () => [...feed.events].sort((a, b) => PRO_EVENT_ORDER.indexOf(a.event) - PRO_EVENT_ORDER.indexOf(b.event)),
    [feed.events],
  );

  // Default to the first event that has a live match, else the first event.
  const defaultEvent = (events.find((e) => e.live.length > 0) ?? events[0])?.event;
  const [active, setActive] = useState<ProEvent | undefined>(defaultEvent);
  // Keep the selection valid as the feed changes (an event can empty out).
  const activeEvent = events.find((e) => e.event === active) ?? events[0];

  if (!activeEvent) return null;
  const shown = [...activeEvent.live, ...activeEvent.vietnam];

  return (
    <div className="wcpro">
      <style>{WCPRO_CSS}</style>
      <div className="wcpro-subtabs" role="tablist" aria-label={language === "vi" ? "Nội dung" : "Events"}>
        {events.map((ev) => (
          <button
            key={ev.event}
            type="button"
            role="tab"
            aria-selected={ev.event === activeEvent.event}
            className={`wcpro-subtab${ev.event === activeEvent.event ? " active" : ""}`}
            onClick={() => setActive(ev.event)}
          >
            {EVENT_LABEL[ev.event][language]}
            {ev.live.length > 0 && <span className="wcpro-subtab-live" aria-label={language === "vi" ? "đang đấu" : "live"}>{ev.live.length}</span>}
          </button>
        ))}
      </div>

      <div className="wcpro-match-grid">
        {shown.map((m) => (
          <MatchRow key={m.match_id} m={m} lang={language} />
        ))}
      </div>
      <p className="wcpro-source">
        {language === "vi"
          ? "Trận đang đấu + trận có tay vợt Việt Nam · nguồn: ban tổ chức (sporttora.com)"
          : "Live matches + matches with Vietnamese players · source: organizers (sporttora.com)"}
      </p>
    </div>
  );
}

const WCPRO_CSS = `
.wcpro-subtabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; scrollbar-width: thin; }
.wcpro-subtab { flex: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--tl-dim); background: var(--tl-bg-elev); border: 1px solid var(--tl-border); border-radius: 999px; padding: 6px 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: color .12s, border-color .12s; }
.wcpro-subtab:hover { color: var(--tl-fg); }
.wcpro-subtab.active { color: var(--tl-fg); border-color: var(--tl-fg); font-weight: 700; }
.wcpro-subtab-live { font-size: 10px; font-weight: 700; color: #fff; background: var(--tl-live); border-radius: 999px; padding: 0 6px; line-height: 16px; min-width: 16px; text-align: center; }
.wcpro-subtab:focus-visible { outline: 2px solid var(--tl-gold); outline-offset: 2px; }
.wcpro-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tl-live); animation: wcpro-pulse 1.4s ease-in-out infinite; flex: none; }
@keyframes wcpro-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .wcpro-dot { animation: none; } }
.wcpro-match-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
.wcpro-match { border: 1px solid var(--tl-border); border-radius: var(--tl-radius, 10px); background: var(--tl-bg-elev); padding: 10px 12px; }
.wcpro-match--live { border-color: var(--tl-live); }
.wcpro-match-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.wcpro-round { font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); }
.wcpro-live-tag { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tl-live); display: inline-flex; align-items: center; gap: 5px; }
.wcpro-done-tag { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tl-dim); }
.wcpro-sched { font-size: 10.5px; color: var(--tl-dim); }
.wcpro-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 2px 0; color: var(--tl-dim); font-size: 14px; }
.wcpro-row--win { color: var(--tl-fg); font-weight: 700; }
.wcpro-name { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; }
.wcpro-name--vn { color: var(--tl-live); }
.wcpro-row--win .wcpro-name--vn { color: var(--tl-live); }
.wcpro-seed { font-size: 10px; color: var(--tl-dim); font-variant-numeric: tabular-nums; flex: none; }
.wcpro-serve { color: var(--tl-gold); font-weight: 700; }
.wcpro-score { margin-top: 6px; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--tl-fg); letter-spacing: .02em; }
.wcpro-source { margin: 16px 0 0; font-size: 11.5px; color: var(--tl-dim); }
`;
