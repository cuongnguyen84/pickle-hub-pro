// ============================================================================
// WorldCupLiveBoard — the World Cup 2026 board on /live, as a two-level tab UI.
//
// Level 1: [ Cá nhân Pro | Đội tuyển ]. The Pro tab (individual events, live
// now) leads; the team tab holds the 16-group draw. Inside the Pro tab, a row
// of sub-tabs splits it by event (see WorldCupProContent).
//
// This container owns both data hooks, the shared header, the level-1 tabs and
// the self-hide/self-retire logic; the two content components are purely
// presentational. Calling the hooks here and (indirectly) nowhere else keeps a
// single fetch per feed — React Query dedupes by key anyway.
// ============================================================================

import { useEffect, useState } from "react";
import { useWcProLive } from "@/hooks/useWcProLive";
import { useWcOpenLive } from "@/hooks/useWcOpenLive";
import { WorldCupProContent } from "@/components/live/WorldCupProPanel";
import { WorldCupOpenContent } from "@/components/live/WorldCupOpenPanel";

const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
type Lang = "en" | "vi";
type Tab = "pro" | "team";

export function WorldCupLiveBoard({ language }: { language: Lang }) {
  const pro = useWcProLive();
  const team = useWcOpenLive();

  const proHasData = (pro.data?.events.length ?? 0) > 0;
  const teamHasData = (team.data?.groups.length ?? 0) > 0;
  const loading = pro.isLoading || team.isLoading;

  // Pro leads when it has matches (it's the live one); fall back to team.
  const [tab, setTab] = useState<Tab>("pro");
  // Keep the selected tab on one that has data as feeds change.
  useEffect(() => {
    if (tab === "pro" && !proHasData && teamHasData) setTab("team");
    if (tab === "team" && !teamHasData && proHasData) setTab("pro");
  }, [tab, proHasData, teamHasData]);

  // Self-retire after the event; stay invisible if both feeds are empty/errored.
  if (Date.now() > HIDE_AFTER) return null;
  if (!loading && !proHasData && !teamHasData) return null;

  const activeTab: Tab = tab === "pro" && !proHasData && teamHasData ? "team" : tab;

  return (
    <section className="wcb" aria-label={language === "vi" ? "World Cup Đà Nẵng — trực tiếp" : "World Cup Da Nang — live"}>
      <style>{WCB_CSS}</style>
      <div className="wcb-head">
        <span className="wcb-kicker">🏓 Pickleball World Cup 2026 · Đà Nẵng</span>
        <h2 className="wcb-title">{language === "vi" ? "Trực tiếp giải" : "Live from the tournament"}</h2>
      </div>

      <div className="wcb-tabs" role="tablist" aria-label={language === "vi" ? "Nhóm giải" : "Competitions"}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pro"}
          className={`wcb-tab${activeTab === "pro" ? " active" : ""}`}
          onClick={() => setTab("pro")}
          disabled={!proHasData && !loading}
        >
          {language === "vi" ? "Cá nhân Pro" : "Pro Individual"}
          {!!pro.data?.liveCount && <span className="wcb-tab-live">{pro.data.liveCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "team"}
          className={`wcb-tab${activeTab === "team" ? " active" : ""}`}
          onClick={() => setTab("team")}
          disabled={!teamHasData && !loading}
        >
          {language === "vi" ? "Đội tuyển" : "National Teams"}
        </button>
      </div>

      <div className="wcb-body">
        {loading ? (
          <p className="wcb-loading">{language === "vi" ? "Đang tải…" : "Loading…"}</p>
        ) : activeTab === "pro" && pro.data ? (
          <WorldCupProContent feed={pro.data} language={language} />
        ) : team.data ? (
          <WorldCupOpenContent feed={team.data} language={language} />
        ) : null}
      </div>
    </section>
  );
}

const WCB_CSS = `
.wcb { border: 1px solid var(--tl-border); border-radius: var(--tl-radius-xl, 20px); background: var(--tl-surface); padding: 20px; margin: 8px 0 28px; }
.wcb-head { margin-bottom: 14px; }
.wcb-kicker { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--tl-gold); font-weight: 700; }
.wcb-title { margin: 4px 0 0; font-size: 19px; line-height: 1.2; color: var(--tl-fg); font-weight: 800; }
.wcb-tabs { display: flex; gap: 8px; margin-bottom: 18px; border-bottom: 1px solid var(--tl-border); }
.wcb-tab { font-family: inherit; font-size: 14.5px; font-weight: 600; color: var(--tl-dim); background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 4px; margin-bottom: -1px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: color .12s, border-color .12s; }
.wcb-tab:hover:not(:disabled) { color: var(--tl-fg); }
.wcb-tab.active { color: var(--tl-fg); border-bottom-color: var(--tl-live); font-weight: 800; }
.wcb-tab:disabled { opacity: .4; cursor: default; }
.wcb-tab:focus-visible { outline: 2px solid var(--tl-gold); outline-offset: 2px; border-radius: 4px; }
.wcb-tab-live { font-size: 11px; font-weight: 700; color: #fff; background: var(--tl-live); border-radius: 999px; padding: 0 7px; line-height: 18px; min-width: 18px; text-align: center; }
.wcb-loading { color: var(--tl-dim); font-size: 13px; padding: 20px 0; }
`;
