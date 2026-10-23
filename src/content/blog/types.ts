export interface BlogSection {
  heading: string;
  content: string;
  listItems?: string[];
  orderedList?: string[];
  internalLinks?: { text: string; path: string }[];
  table?: { caption?: string; headers: string[]; rows: string[][] };
  image?: { src: string; alt: string; caption?: string };
  /** Mount a live data block under this section instead of static content.
   *  "wc-results" renders the World Cup 2026 results table from
   *  wc_pro_matches — React on the human path, server-rendered HTML on the
   *  bot path (functions/_lib/render/wc-results.ts). */
  liveBlock?: "wc-results";
  /** Structured tournament results for one draw, emitted by
   *  scripts/blog/tournament_results_autopublish.py alongside the prose
   *  summary in `content`. When present, renderers show the board (round
   *  groups, winner/loser rows, set scores) INSTEAD of `listItems`:
   *  React ResultsBoard on the EN human path, static HTML on the bot path
   *  (functions/_lib/render/blog-body.ts) and in the VI body rendered by
   *  scripts/ops/team_wriai.py (vi_html). Facts are the feed's own —
   *  winner/loser names and set scores are never re-derived at render. */
  resultsBoard?: ResultsBoard;
  /** Page-level summary for a results post (one row per draw), carried by
   *  the intro section only. Rendered as the summary card above the first
   *  resultsBoard section; `anchor` is the in-page id of that draw's board
   *  section, derived from the division name by the same slug rule in the
   *  generator and every renderer. */
  resultsSummary?: ResultsSummaryDraw[];
}

export interface ResultsBoardMatch {
  winner: string;
  loser: string;
  /** Set scores as [winner, loser] pairs, in set order. */
  sets: [number, number][];
  /** Non-standard endings worth surfacing: "walkover" | "retired". */
  status?: string;
}

export interface ResultsBoardRound {
  /** Localized round label ("Quarter Finals" / "Tứ kết"). */
  label: string;
  /** Early rounds (Round of 32 and below) start collapsed. */
  collapsed?: boolean;
  matches: ResultsBoardMatch[];
}

export interface ResultsBoard {
  /** Division display name in this section's language. */
  division: string;
  champion?: string;
  rounds: ResultsBoardRound[];
}

export interface ResultsSummaryDraw {
  division: string;
  champion?: string;
  /** Localized status line, e.g. "Through to the Semi Finals · 20 matches". */
  note: string;
  /** In-page anchor id of the draw's board section, e.g. "rb-womens-doubles". */
  anchor: string;
}

export interface BlogPostContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  sections: BlogSection[];
  faqItems?: { question: string; answer: string }[];
  howToSteps?: { name: string; text: string }[];
}

export interface BlogPost {
  slug: string;
  publishedDate: string;
  updatedDate: string;
  author: string;
  tags: string[];
  ctaPath: string;
  ctaLabel: { en: string; vi: string };
  heroImage?: { src: string; alt: string };
  content: {
    en: BlogPostContent;
    vi: BlogPostContent;
  };
}

/**
 * Lightweight metadata shape — used by list pages (Blog index, home section)
 * so we don't load full section content / FAQ data for every card on the list.
 */
export interface BlogPostMetadata {
  slug: string;
  publishedDate: string;
  updatedDate: string;
  author: string;
  tags: string[];
  ctaPath: string;
  ctaLabel: { en: string; vi: string };
  heroImage?: { src: string; alt: string };
  titleEn: string;
  titleVi: string;
  metaTitleEn: string;
  metaTitleVi: string;
  metaDescriptionEn: string;
  metaDescriptionVi: string;
}
