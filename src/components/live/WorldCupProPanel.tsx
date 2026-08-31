// ============================================================================
// WorldCupProPanel — the OPEN/Pro individual events board on /live
//
// The five Pro draws (men's & women's singles, men's & women's doubles, mixed)
// are being played now. This board shows, per event, the matches in progress
// with their live score, and Vietnamese players' matches (upcoming, and results
// kept after they finished). Vietnamese entrant highlighted; the leading side
// in bold. Repaints over Supabase Realtime as scores change.
//
// Self-contained (scoped `wcpro-` styles on TheLine's --tl-* tokens) and
// self-retiring after the event, like the team panel it sits above.
// ============================================================================

import { useWcProLive, PRO_EVENT_ORDER, type ProEvent, type WcProMatchRow } from "@/hooks/useWcProLive";
import { isVietnameseName } from "@/lib/wc-open/parse-pro";

const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
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

function scoreLine(m: WcProMatchRow): string {
  const games = m.games_json ?? [];
  const parts = games.map((g) => `${g.a}-${g.b}`);
  if (m.status === "in_progress" && m.current_a != null && m.current_b != null) {
    parts.push(`${m.current_a}-${m.current_b}`);
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

export function WorldCupProPanel({ language }: { language: Lang }) {
  const { data, isLoading, isError } = useWcProLive();

  if (Date.now() > HIDE_AFTER) return null;
  if (isError) return null;
  if (!isLoading && (!data || data.events.length === 0)) return null;

  return (
    <section className="wcpro" aria-label={language === "vi" ? "World Cup — Cá nhân Pro" : "World Cup — Pro individual events"}>
      <style>{WCPRO_CSS}</style>
      <div className="wcpro-head">
        <div>
          <span className="wcpro-kicker">🏓 Pickleball World Cup 2026 · Đà Nẵng</span>
          <h2 className="wcpro-title">{language === "vi" ? "Cá nhân Pro — trực tiếp" : "Pro Individual — live"}</h2>
        </div>
        {!!data?.liveCount && (
          <span className="wcpro-status wcpro-status--live">
            <span className="wcpro-dot" aria-hidden="true" />
            {data.liveCount} {language === "vi" ? "trận đang đấu" : "live"}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="wcpro-loading">{language === "vi" ? "Đang tải…" : "Loading…"}</p>
      ) : (
        <div className="wcpro-events">
          {data!.events
            .slice()
            .sort((a, b) => PRO_EVENT_ORDER.indexOf(a.event) - PRO_EVENT_ORDER.indexOf(b.event))
            .map((ev) => {
              const shown = [...ev.live, ...ev.vietnam];
              return (
                <div key={ev.event} className="wcpro-event">
                  <h3 className="wcpro-event-title">
                    {EVENT_LABEL[ev.event][language]}
                    {ev.live.length > 0 && <span className="wcpro-event-live">{ev.live.length} {language === "vi" ? "live" : "live"}</span>}
                  </h3>
                  <div className="wcpro-match-grid">
                    {shown.map((m) => (
                      <MatchRow key={m.match_id} m={m} lang={language} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <p className="wcpro-source">
        {language === "vi"
          ? "Trận đang đấu + trận có tay vợt Việt Nam · nguồn: ban tổ chức (sporttora.com) · cập nhật gần thời gian thực"
          : "Live matches + matches with Vietnamese players · source: organizers (sporttora.com) · near real-time"}
      </p>
    </section>
  );
}

const WCPRO_CSS = `
.wcpro { border: 1px solid var(--tl-border); border-radius: var(--tl-radius-xl, 20px); background: var(--tl-surface); padding: 20px; margin: 8px 0 20px; }
.wcpro-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.wcpro-kicker { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--tl-gold); font-weight: 700; }
.wcpro-title { margin: 4px 0 0; font-size: 19px; line-height: 1.2; color: var(--tl-fg); font-weight: 800; }
.wcpro-status { font-size: 12.5px; font-weight: 600; padding: 5px 11px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; color: var(--tl-live); border: 1px solid var(--tl-live); }
.wcpro-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tl-live); animation: wcpro-pulse 1.4s ease-in-out infinite; flex: none; }
@keyframes wcpro-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .wcpro-dot { animation: none; } }
.wcpro-events { display: flex; flex-direction: column; gap: 18px; }
.wcpro-event-title { margin: 0 0 10px; font-size: 14px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--tl-fg); display: flex; align-items: center; gap: 9px; }
.wcpro-event-live { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tl-live); border: 1px solid var(--tl-live); border-radius: 999px; padding: 1px 7px; }
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
.wcpro-loading { color: var(--tl-dim); font-size: 13px; padding: 16px 0; }
`;
