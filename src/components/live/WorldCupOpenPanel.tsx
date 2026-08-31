// ============================================================================
// WorldCupOpenPanel — the World Cup 2026 OPEN national-team board on /live
//
// Renders the 16 OPEN groups from useWcOpenLive, Vietnam's Group A first and
// highlighted, and repaints over Supabase Realtime as the scraper writes
// updates. Bilingual. Scope is OPEN + national team only — nothing else.
//
// Self-contained on purpose: this is a tournament-week panel that comes down
// after Sep 6, so its styles live in one scoped <style> block (prefix `wcop-`)
// rather than in the global TheLine stylesheet, and the whole thing can be
// deleted in one commit. The panel hides itself after the event window.
//
// Before Sep 3 the matches table is empty, so the board shows the draw with a
// "chưa đấu / not started" state instead of inventing scores — drawOnly drives
// that. Once ties are played, scores and a Live pill appear.
// ============================================================================

import { useWcOpenLive, type WcOpenGroup, type WcOpenTeamRow } from "@/hooks/useWcOpenLive";

// The OPEN national-team competition ends Sep 6, 2026; keep the board up a day
// after for the record, then it stops rendering on its own.
const HIDE_AFTER = Date.UTC(2026, 8, 7, 17, 0, 0); // 2026-09-08 00:00 Vietnam time
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

export function WorldCupOpenPanel({ language }: { language: Lang }) {
  const { data, isLoading, isError } = useWcOpenLive();

  // Self-retire after the event, and stay invisible if the feed is empty or errored.
  if (Date.now() > HIDE_AFTER) return null;
  if (isError) return null;
  if (!isLoading && (!data || data.groups.length === 0)) return null;

  // Vietnam's group first, then the rest alphabetically.
  const groups = data
    ? [...data.groups].sort((a, b) => {
        const av = a.teams.some((t) => t.slug === VN_SLUG) ? 0 : 1;
        const bv = b.teams.some((t) => t.slug === VN_SLUG) ? 0 : 1;
        return av - bv || a.letter.localeCompare(b.letter);
      })
    : [];

  const statusLine = data?.hasLive
    ? language === "vi" ? "Đang thi đấu" : "Live now"
    : data?.drawOnly
      ? language === "vi" ? "Phân bảng — Đồng đội khởi tranh 3/9" : "Group draw — team play starts Sep 3"
      : language === "vi" ? "Vòng bảng" : "Group stage";

  return (
    <section className="wcop" aria-label={language === "vi" ? "World Cup Đà Nẵng — Đội tuyển OPEN" : "World Cup Da Nang — OPEN national teams"}>
      <style>{WCOP_CSS}</style>
      <div className="wcop-head">
        <div className="wcop-title-wrap">
          <span className="wcop-kicker">🏓 Pickleball World Cup 2026 · Đà Nẵng</span>
          <h2 className="wcop-title">
            {language === "vi" ? "Đội tuyển OPEN — 16 bảng, 64 quốc gia" : "OPEN National Teams — 16 groups, 64 nations"}
          </h2>
        </div>
        <span className={`wcop-status${data?.hasLive ? " wcop-status--live" : ""}`}>
          {data?.hasLive && <span className="wcop-dot" aria-hidden="true" />}
          {statusLine}
        </span>
      </div>

      {isLoading ? (
        <p className="wcop-loading">{language === "vi" ? "Đang tải bảng đấu…" : "Loading groups…"}</p>
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}

// Scoped styles. Built entirely on TheLine's own tokens (--tl-*) so the panel
// inherits the site's theme instead of fighting it — the site is a fixed
// dark-first design (data-theme="the-line" on <html>) that also has a light
// variant, and --tl-* already resolve correctly in both. Vietnam is picked out
// with --tl-live (the site's red), the one bold colour, kept to Vietnam's row
// and group so the board otherwise reads as a neutral table.
const WCOP_CSS = `
.wcop {
  border: 1px solid var(--tl-border); border-radius: var(--tl-radius-xl, 20px);
  background: var(--tl-surface); padding: 20px; margin: 8px 0 28px;
}
.wcop-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.wcop-kicker { font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--tl-gold); font-weight: 700; }
.wcop-title { margin: 4px 0 0; font-size: 19px; line-height: 1.2; color: var(--tl-fg); font-weight: 800; }
.wcop-status { font-size: 12.5px; font-weight: 600; color: var(--tl-dim); background: var(--tl-bg-elev); border: 1px solid var(--tl-border); padding: 5px 11px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; }
.wcop-status--live { color: var(--tl-live); border-color: var(--tl-live); }
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
.wcop-loading { color: var(--tl-dim); font-size: 13px; padding: 20px 0; }
`;
