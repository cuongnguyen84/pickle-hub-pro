import { Link } from "react-router-dom";

/**
 * Top-level ranking-type switcher shown on BOTH /rankings and
 * /rankings/ppa-tour. These are two real pathnames, so this is a <nav> of
 * links with aria-current — NOT role="tablist" (no in-page panels, no
 * arrow-key model). Proposal rankings-dupr-wpr-tabs §4a; label copy from
 * ui-ux round 1 (blocker #2: bare "DUPR"/"WPR" are ambiguous to casual
 * Vietnamese players).
 */

interface RankingsTabsProps {
  active: "dupr" | "wpr";
  language: "vi" | "en";
}

export function RankingsTabs({ active, language }: RankingsTabsProps) {
  const vi = language === "vi";
  const tabs = [
    {
      key: "dupr" as const,
      to: vi ? "/vi/rankings" : "/rankings",
      title: "DUPR",
      caption: vi ? "RATING CÁ NHÂN" : "PLAYER RATING",
    },
    {
      key: "wpr" as const,
      to: vi ? "/vi/rankings/ppa-tour" : "/rankings/ppa-tour",
      title: "WPR",
      caption: vi ? "NHÀ NGHỀ PPA TOUR" : "PPA TOUR PROS",
    },
  ];

  return (
    <nav className="tl-tabs" aria-label={vi ? "Loại bảng xếp hạng" : "Ranking type"}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={`tl-tab ${active === t.key ? "active" : ""}`}
          aria-current={active === t.key ? "page" : undefined}
        >
          <span className="tl-tab-title">{t.title}</span>
          <span className="tl-tab-caption">{t.caption}</span>
        </Link>
      ))}
    </nav>
  );
}
