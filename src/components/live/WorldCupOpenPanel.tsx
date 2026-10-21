// ============================================================================
// WorldCupOpenContent — the OPEN national-team board, as one tab of the World
// Cup live board (see WorldCupLiveBoard). Presentational: it takes an already
// fetched WcOpenFeed and renders the 16 groups, Vietnam's Group A first and
// highlighted. The container owns the hook, the header and the tab chrome; this
// file owns the group table only.
//
// Before Sep 3 the matches table is empty, so it shows the draw with a
// "khởi tranh 3/9" status instead of inventing scores (drawOnly drives that).
// Scoped `wcop-` styles on TheLine's --tl-* tokens.
// ============================================================================

import type { WcOpenFeed, WcOpenGroup, WcOpenTeamRow } from "@/hooks/useWcOpenLive";

const VN_SLUG = "viet_nam";
type Lang = "en" | "vi";

/** A country flag from its ISO code, via regional-indicator letters. */
function flag(cc: string | null): string {
  if (!cc || cc.length < 2) return "🏳️";
  const base = 0x1f1e6;
  const up = cc.slice(0, 2).toUpperCase();
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}

const teamName = (t: WcOpenTeamRow, lang: Lang) => (lang === "vi" ? t.name_vi : t.name_en);

function GroupCard({ group, lang }: { group: WcOpenGroup; lang: Lang }) {
  const hasVN = group.teams.some((t) => t.slug === VN_SLUG);
  const played = group.matches.filter((m) => m.status !== "scheduled").length;
  return (
    <div className={`wcop-group${hasVN ? " wcop-group--vn" : ""}`}>
      <div className="wcop-group-head">
        <span className="wcop-group-letter">{lang === "vi" ? "Bảng" : "Group"} {group.letter}</span>
        {hasVN && <span className="wcop-vn-tag">{lang === "vi" ? "Việt Nam" : "Vietnam"}</span>}
        {played > 0 && (
          <span className="wcop-played">{played}/{group.matches.length} {lang === "vi" ? "trận" : "played"}</span>
        )}
      </div>
      <ul className="wcop-team-list">
        {group.teams.map((t) => (
          <li key={t.slug} className={`wcop-team${t.slug === VN_SLUG ? " wcop-team--vn" : ""}`}>
            <span className="wcop-flag" aria-hidden="true">{flag(t.country_code)}</span>
            <span className="wcop-team-name">{teamName(t, lang)}</span>
            {t.seed != null && <span className="wcop-seed" title={lang === "vi" ? "Hạt giống" : "Seed"}>#{t.seed}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorldCupOpenContent({ feed, language }: { feed: WcOpenFeed; language: Lang }) {
  // Vietnam's group first, then the rest alphabetically.
  const groups = [...feed.groups].sort((a, b) => {
    const av = a.teams.some((t) => t.slug === VN_SLUG) ? 0 : 1;
    const bv = b.teams.some((t) => t.slug === VN_SLUG) ? 0 : 1;
    return av - bv || a.letter.localeCompare(b.letter);
  });

  const statusLine = feed.hasLive
    ? language === "vi" ? "Đang thi đấu" : "Live now"
    : feed.drawOnly
      ? language === "vi" ? "Phân bảng — Đồng đội khởi tranh 3/9" : "Group draw — team play starts Sep 3"
      : language === "vi" ? "Vòng bảng" : "Group stage";

  return (
    <div className="wcop">
      <style>{WCOP_CSS}</style>
      <div className="wcop-substatus">
        <span className={`wcop-status${feed.hasLive ? " wcop-status--live" : ""}`}>
          {feed.hasLive && <span className="wcop-dot" aria-hidden="true" />}
          {statusLine}
        </span>
        <span className="wcop-count">{language === "vi" ? "16 bảng · 64 quốc gia" : "16 groups · 64 nations"}</span>
      </div>
      <div className="wcop-grid">
        {groups.map((g) => (
          <GroupCard key={g.letter} group={g} lang={language} />
        ))}
      </div>
      <p className="wcop-source">
        {language === "vi"
          ? "Nguồn: ban tổ chức (sporttora.com) · cập nhật gần thời gian thực trong giờ thi đấu"
          : "Source: organizers (sporttora.com) · updated near real-time during play"}
      </p>
    </div>
  );
}

// Scoped styles on TheLine's --tl-* tokens so the panel inherits the site theme.
// Vietnam is picked out with --tl-live (the site red), kept to Vietnam's row and
// group so the board otherwise reads as a neutral table.
const WCOP_CSS = `
.wcop-substatus { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
.wcop-status { font-size: 12.5px; font-weight: 600; color: var(--tl-dim); background: var(--tl-bg-elev); border: 1px solid var(--tl-border); padding: 5px 11px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; }
.wcop-status--live { color: var(--tl-live); border-color: var(--tl-live); }
.wcop-count { font-size: 12px; color: var(--tl-dim); }
.wcop-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tl-live); animation: wcop-pulse 1.4s ease-in-out infinite; }
@keyframes wcop-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .wcop-dot { animation: none; } }
.wcop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 12px; }
.wcop-group { border: 1px solid var(--tl-border); border-radius: var(--tl-radius, 10px); background: var(--tl-bg-elev); padding: 12px 14px; }
.wcop-group--vn { border-color: var(--tl-live); box-shadow: 0 0 0 1px var(--tl-live) inset; }
.wcop-group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.wcop-group-letter { font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--tl-fg); }
.wcop-vn-tag { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tl-live); border: 1px solid var(--tl-live); padding: 2px 7px; border-radius: 999px; }
.wcop-played { margin-left: auto; font-size: 11px; color: var(--tl-dim); font-variant-numeric: tabular-nums; }
.wcop-team-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.wcop-team { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--tl-dim); }
.wcop-team--vn { color: var(--tl-fg); font-weight: 700; }
.wcop-flag { font-size: 15px; line-height: 1; flex: none; }
.wcop-team-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wcop-seed { margin-left: auto; font-size: 11px; color: var(--tl-dim); font-variant-numeric: tabular-nums; }
.wcop-source { margin: 14px 0 0; font-size: 11.5px; color: var(--tl-dim); }
`;
