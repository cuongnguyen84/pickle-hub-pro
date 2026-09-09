// ============================================================================
// LiveProEvent — /live/pro/<slug> (+ /vi twin): every pro-tour bracket match
// the pipeline has for one tournament, grouped events → rounds → matches.
// Registry-driven (src/content/pro-tour-events.ts); data is the `matches`
// rows the pro-tour scraper writes (source_provider = 'ppa_tour'). Before the
// first match lands it renders an honest "not started" state, and while the
// event is live the hook polls every minute — no manual refresh needed.
// ============================================================================

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ErrorState } from "@/components/states/PageStates";
import { eventPhase, formatEventDates } from "@/content/pro-tour-events";
import { useProTourEvent } from "@/hooks/useProTourEvents";
import { useProTourEventResults } from "@/hooks/useProTourEventResults";
import {
  filterProResults,
  playersLine,
  scoreLine,
  type ProResultEvent,
  type ProResultMatch,
} from "@/lib/pro-tour/results";

const PHASE_LABEL = {
  upcoming: { vi: "Sắp diễn ra", en: "Upcoming" },
  live: { vi: "Đang diễn ra", en: "In progress" },
  finished: { vi: "Đã kết thúc", en: "Finished" },
} as const;

export default function LiveProEvent() {
  const { slug = "" } = useParams();
  const { language } = useI18n();
  const vi = language === "vi";
  const { meta, isLoading: metaLoading } = useProTourEvent(slug);
  const results = useProTourEventResults(meta);
  const [playerQuery, setPlayerQuery] = useState("");

  if (metaLoading && !meta) {
    return (
      <TheLineLayout title="…" description="" active="live">
        <div className="tl-shell">
          <p style={{ color: "var(--tl-dim)" }}>{vi ? "Đang tải…" : "Loading…"}</p>
        </div>
      </TheLineLayout>
    );
  }

  if (!meta) {
    return (
      <TheLineLayout
        title={vi ? "Không tìm thấy giải" : "Event not found"}
        description=""
        active="live"
      >
        <div className="tl-shell">
          <div className="tl-empty" role="alert">
            <h3>{vi ? "Không có giải nào ở địa chỉ này." : "No event lives at this address."}</h3>
          </div>
          <p style={{ marginTop: 12 }}>
            <Link to={vi ? "/vi/live" : "/live"}>
              ← {vi ? "Về Sân trực tiếp" : "Back to Live courts"}
            </Link>
          </p>
        </div>
      </TheLineLayout>
    );
  }

  const phase = eventPhase(meta);
  const name = vi ? meta.nameVi : meta.nameEn;
  const description = vi
    ? `Kết quả và nhánh đấu ${name} — ${meta.city}, ${meta.country}, ${formatEventDates(meta, "vi")}.`
    : `Results and draws for ${name} — ${meta.city}, ${meta.country}, ${formatEventDates(meta, "en")}.`;

  return (
    <TheLineLayout title={name} description={description} active="live">
      <div className="tl-shell">
        <style>{LPE_CSS}</style>
        <nav className="tl-breadcrumb">
          <Link to={vi ? "/vi" : "/"}>{vi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <Link to={vi ? "/vi/live" : "/live"}>{vi ? "Sân trực tiếp" : "Live courts"}</Link>
          <span className="sep">/</span>
          <span className="current">{meta.city}</span>
        </nav>

        <header className="tl-page-head lpe-head">
          <div className="kicker">
            ◆ {meta.tier} · {meta.tour}
          </div>
          <h1 className="lpe-title">{name}</h1>
          <p className="lpe-meta">
            {formatEventDates(meta, language)} · {meta.city}, {meta.country}
            {meta.venue ? ` · ${meta.venue}` : ""}
            {meta.prizeMoney ? ` · ${meta.prizeMoney}` : ""}
          </p>
          <p className="lpe-badges">
            <span className={`lpe-phase lpe-phase--${phase}`}>
              {phase === "live" && <span className="lpe-dot" aria-hidden="true" />}
              {PHASE_LABEL[phase][language]}
            </span>
            {phase === "live" && (
              <span className="lpe-poll">
                {vi ? "Tự cập nhật mỗi phút" : "Auto-refreshes every minute"}
              </span>
            )}
          </p>
          <p className="lpe-links">
            <a href={meta.bracketsUrl} target="_blank" rel="noopener noreferrer">
              {vi ? "Nhánh đấu gốc ↗" : "Official draws ↗"}
            </a>
            <a href={meta.officialUrl} target="_blank" rel="noopener noreferrer">
              {vi ? "Trang giải ↗" : "Tournament site ↗"}
            </a>
          </p>
        </header>

        {results.isError ? (
          <ErrorState onRetry={() => void results.refetch()} />
        ) : results.isLoading ? (
          <p className="lpe-empty">{vi ? "Đang tải kết quả…" : "Loading results…"}</p>
        ) : !results.data || results.data.total === 0 ? (
          <div className="lpe-empty">
            {phase === "upcoming" ? (
              <p>
                {vi
                  ? `Giải chưa bắt đầu — trận đầu tiên dự kiến ngày ${formatEventDates(meta, "vi")}. Kết quả sẽ hiện ở đây ngay khi có.`
                  : `Play has not started — first matches are expected ${formatEventDates(meta, "en")}. Results appear here as soon as they land.`}
              </p>
            ) : (
              <p>
                {vi
                  ? "Chưa có trận nào trong dữ liệu. Nguồn nhánh đấu có thể đang cập nhật chậm — xem link nhánh đấu gốc ở trên."
                  : "No matches in the data yet. The bracket source may be lagging — see the official draws link above."}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="lpe-search">
              <input
                type="search"
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder={vi ? "Tìm theo tên VĐV…" : "Search players…"}
                aria-label={vi ? "Tìm trận theo tên vận động viên" : "Search matches by player name"}
              />
              {playerQuery && (
                <button type="button" className="lpe-search-clear" onClick={() => setPlayerQuery("")}
                  aria-label={vi ? "Xoá tìm kiếm" : "Clear search"}>
                  ✕
                </button>
              )}
            </div>
            {(() => {
              const shown = filterProResults(results.data, playerQuery);
              if (playerQuery.trim() && shown.total === 0) {
                return (
                  <div className="lpe-empty">
                    <p>
                      {vi
                        ? `Không có trận nào của VĐV khớp "${playerQuery}".`
                        : `No matches for a player matching "${playerQuery}".`}
                    </p>
                  </div>
                );
              }
              return (
                <>
                  {playerQuery.trim() !== "" && (
                    <p className="lpe-vn-note">
                      {vi
                        ? `${shown.total} trận khớp "${playerQuery}"`
                        : `${shown.total} matches for "${playerQuery}"`}
                    </p>
                  )}
                  <ResultsTree shown={shown} vi={vi} showVnNote={!playerQuery.trim()} />
                </>
              );
            })()}
          </>
        )}
      </div>
    </TheLineLayout>
  );
}

function ResultsTree({
  shown,
  vi,
  showVnNote,
}: {
  shown: ReturnType<typeof filterProResults>;
  vi: boolean;
  showVnNote: boolean;
}) {
  return (
    <>
      {showVnNote && shown.vietnamCount > 0 && (
              <p className="lpe-vn-note">
                🇻🇳{" "}
                {vi
                  ? `${shown.vietnamCount} trận có VĐV Việt Nam — được đánh dấu bên dưới.`
                  : `${shown.vietnamCount} matches feature Vietnamese players — highlighted below.`}
              </p>
            )}
            {/* was: results.data 🇻🇳 note — now lives in ResultsTree */}
      {shown.events.map((ev) => (
        <EventSection key={ev.name} ev={ev} vi={vi} />
      ))}
    </>
  );
}

function EventSection({ ev, vi }: { ev: ProResultEvent; vi: boolean }) {
  return (
    <section className="lpe-event" aria-label={vi ? ev.labelVi : ev.labelEn}>
      <div className="lpe-event-head">
        <h2>{vi ? ev.labelVi : ev.labelEn}</h2>
        {ev.champion && (
          <span className="lpe-champ">🏆 {playersLine(ev.champion)}</span>
        )}
      </div>
      {ev.rounds.map((round) => (
        <div key={round.code} className="lpe-round">
          <h3>{vi ? round.labelVi : round.labelEn}</h3>
          <div className="lpe-matches">
            {round.matches.map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function MatchRow({ m }: { m: ProResultMatch }) {
  return (
    <div className={`lpe-match${m.hasVietnam ? " lpe-match--vn" : ""}${m.isLive ? " lpe-match--on" : ""}`}>
      {m.isLive && (
        <span className="lpe-live" aria-label="live">
          <span className="lpe-live-dot" aria-hidden="true" />
          LIVE
        </span>
      )}
      <div className="lpe-teams">
        <span className={m.winner === "a" ? "lpe-win" : undefined}>
          {playersLine(m.teamA)}
          {m.teamA.some((p) => p.isVietnam) && <span aria-hidden="true"> 🇻🇳</span>}
        </span>
        <span className="lpe-vs">vs</span>
        <span className={m.winner === "b" ? "lpe-win" : undefined}>
          {playersLine(m.teamB)}
          {m.teamB.some((p) => p.isVietnam) && <span aria-hidden="true"> 🇻🇳</span>}
        </span>
      </div>
      <span className="lpe-score">{scoreLine(m) || "—"}</span>
    </div>
  );
}

const LPE_CSS = `
.lpe-match--on { border-color: var(--tl-live); }
.lpe-live { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; color: var(--tl-live); }
.lpe-live-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tl-live); animation: lpePulse 1.4s ease-in-out infinite; }
@keyframes lpePulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tl-live) 45%, transparent); } 50% { box-shadow: 0 0 0 5px transparent; } }
.lpe-search { position: relative; margin: 4px 0 14px; max-width: 420px; }
.lpe-search input { width: 100%; padding: 10px 38px 10px 14px; font-size: 14.5px; color: var(--tl-fg); background: var(--tl-surface); border: 1px solid var(--tl-border); border-radius: 12px; outline: none; }
.lpe-search input:focus-visible { border-color: var(--tl-gold); }
.lpe-search input::placeholder { color: var(--tl-dim); }
.lpe-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0; background: none; color: var(--tl-dim); font-size: 14px; cursor: pointer; padding: 4px 6px; }
.lpe-search-clear:hover { color: var(--tl-fg); }
.lpe-title { overflow-wrap: anywhere; }
.lpe-meta { color: var(--tl-dim); }
.lpe-badges { display: flex; align-items: center; gap: 12px; margin: 8px 0 0; }
.lpe-phase { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-dim); display: inline-flex; align-items: center; gap: 6px; }
.lpe-phase--live { color: var(--tl-live); }
.lpe-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tl-live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tl-live) 25%, transparent); }
.lpe-poll { font-size: 12px; color: var(--tl-dim); }
.lpe-links { display: flex; gap: 16px; margin: 10px 0 0; font-size: 13.5px; }
.lpe-links a { color: var(--tl-fg); font-weight: 700; text-decoration: none; border-bottom: 1px solid var(--tl-border); }
.lpe-links a:hover { border-color: var(--tl-gold); }
.lpe-empty { border: 1px dashed var(--tl-border); border-radius: var(--tl-radius-xl, 20px); padding: 24px; color: var(--tl-dim); margin-top: 8px; }
.lpe-vn-note { font-size: 13.5px; color: var(--tl-dim); margin: 4px 0 16px; }
.lpe-event { margin: 26px 0; }
.lpe-event-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--tl-border); padding-bottom: 8px; margin-bottom: 12px; }
.lpe-event-head h2 { margin: 0; font-size: 20px; }
.lpe-champ { font-size: 13.5px; font-weight: 700; color: var(--tl-gold); }
.lpe-round { margin: 14px 0; }
.lpe-round h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .07em; text-transform: uppercase; color: var(--tl-dim); }
.lpe-matches { display: flex; flex-direction: column; gap: 6px; }
.lpe-match { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--tl-border); border-radius: 12px; background: var(--tl-surface); padding: 10px 14px; }
.lpe-match--vn { border-color: color-mix(in srgb, var(--tl-gold) 55%, var(--tl-border)); }
.lpe-teams { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; min-width: 0; overflow-wrap: anywhere; }
.lpe-vs { color: var(--tl-dim); font-size: 12px; }
.lpe-win { font-weight: 800; }
.lpe-score { font-family: "Geist Mono", ui-monospace, monospace; font-size: 13px; white-space: nowrap; color: var(--tl-fg); }
@media (max-width: 560px) {
  .lpe-match { flex-direction: column; align-items: flex-start; gap: 6px; }
}
`;
