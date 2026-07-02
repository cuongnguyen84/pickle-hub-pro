#!/usr/bin/env python3
"""
Parse DUPR rankings from www.dupr.com and write to
src/content/dupr-rankings.ts.

Sources:
  - https://www.dupr.com/rankings (12 collections = 3 age groups × 4 formats)
      Mapping confirmed by age:
        C1-C4   → Open       (Men's S, Women's S, Men's D, Women's D)
        C5-C8   → 50+ Senior (skipped — not surfaced on TPH)
        C9-C12  → Junior     (same 4 formats)

  - https://www.dupr.com/continental-rankings/{slug}
      Each page = 4 collections (the 4 formats above) for that continent.
      Continents pulled: asia, north-america, south-america,
      australia-oceania, europe.

Phase 2 plan: replace this script + static module with a Supabase
edge function `dupr-ingest` that runs daily and writes to a
`dupr_rankings` table.

Usage:
    python3 scripts/parse-dupr.py
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT = REPO_ROOT / "src" / "content" / "dupr-rankings.ts"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"

CONTINENTS = ["asia", "north-america", "south-america", "australia-oceania", "europe"]

# DUPR's Webflow page renders the 4 ranking-collection blocks in
# this order — confirmed by checking signature top players' ratings
# against publicly-known Singles vs Doubles values (e.g. Ben Johns
# top-rated entry was 7.094 = doubles range, not singles).
# Earlier mapping (Singles first) caused names + ratings to appear
# under the wrong format on the homepage.
DUPR_TAB_ORDER = ["mens-doubles", "womens-doubles", "mens-singles", "womens-singles"]

TOP_N = 25


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def parse_collections(html: str) -> list[list[dict]]:
    """Parse Webflow CMS ranking-collection blocks into player lists."""
    idxs = [m.start() for m in re.finditer(r'class="post_list ranking-collection w-dyn-items"', html)]
    idxs.append(len(html))
    cols: list[list[dict]] = []
    for i in range(len(idxs) - 1):
        chunk = html[idxs[i]:idxs[i + 1]]
        names = re.findall(r'class="heading-table name"[^>]*>([^<]+)', chunk)
        ratings_raw = re.findall(r'class="heading-table right"[^>]*>([^<]+)', chunk)
        ages = re.findall(r'fs-cmsfilter-field="age"[^>]*>([^<]+)', chunk)
        ratings = [r for r in ratings_raw if r != "Rating"]
        items = []
        for j, name in enumerate(names):
            items.append({
                "rank": j + 1,
                "name": name.strip(),
                "age": int(ages[j]) if j < len(ages) and ages[j].strip().isdigit() else None,
                "rating": float(ratings[j]) if j < len(ratings) else None,
            })
        cols.append(items[:TOP_N])
    return cols


def main() -> int:
    print("→ Fetching DUPR /rankings …")
    main_cols = parse_collections(fetch("https://www.dupr.com/rankings"))
    if len(main_cols) < 12:
        print(f"FAIL: expected ≥12 collections from /rankings, got {len(main_cols)}", file=sys.stderr)
        return 1

    groups: dict[str, dict[str, list[dict]]] = {
        "open":   {fmt: main_cols[i] for i, fmt in enumerate(DUPR_TAB_ORDER)},
        "junior": {fmt: main_cols[i + 8] for i, fmt in enumerate(DUPR_TAB_ORDER)},
    }

    for slug in CONTINENTS:
        print(f"→ Fetching DUPR /continental-rankings/{slug} …")
        cont_cols = parse_collections(fetch(f"https://www.dupr.com/continental-rankings/{slug}"))
        if len(cont_cols) < 4:
            print(f"  WARN: {slug} has only {len(cont_cols)} collections — filling empty", file=sys.stderr)
            groups[slug] = {fmt: [] for fmt in DUPR_TAB_ORDER}
        else:
            groups[slug] = {fmt: cont_cols[i] for i, fmt in enumerate(DUPR_TAB_ORDER)}

    today = __import__("datetime").date.today().isoformat()

    header = f'''/**
 * DUPR rankings snapshot — parsed from www.dupr.com on {today}.
 *
 * Source pages:
 *   - https://www.dupr.com/rankings (Open + Junior)
 *   - https://www.dupr.com/continental-rankings/{{asia,north-america,
 *     south-america,australia-oceania,europe}}
 *
 * Each scope has 4 formats (men's singles, women's singles, men's
 * doubles, women's doubles); top {TOP_N} per format.
 *
 * Refresh by running scripts/parse-dupr.py and committing the diff.
 * Phase 2 plan: replace with a `dupr-ingest` Supabase edge function +
 * `dupr_rankings` table that the page reads from at runtime.
 */

export type DuprFormat =
  | "mens-singles"
  | "womens-singles"
  | "mens-doubles"
  | "womens-doubles"
  // Sprint A6 (2026-05-27) — vietnam scope formats (aggregated; profiles has
  // no gender column yet so mens/womens cannot be split). Hidden from
  // non-vietnam tabs via getAvailableFormats() below.
  | "singles"
  | "doubles";
export type DuprScope =
  | "open"
  | "junior"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania"
  | "europe"
  // Sprint A6 (2026-05-27) — national scope, currently Vietnam-only. Reads
  // from public.profiles via dupr_leaderboard_vietnam() RPC at runtime
  // rather than the static const below. UI branches on scope === "vietnam".
  | "vietnam";

export interface DuprPlayer {{
  rank: number;
  name: string;
  age: number | null;
  rating: number | null;
}}

export const DUPR_RANKINGS: Record<
  Exclude<DuprScope, "vietnam">,
  Record<Exclude<DuprFormat, "singles" | "doubles">, DuprPlayer[]>
> = '''

    footer = f'''

export type DuprScopeGroup = "global" | "continent" | "national";

export const DUPR_SCOPES: {{ key: DuprScope; labelEn: string; labelVi: string; group: DuprScopeGroup }}[] = [
  // National scope first — most prominent for the ~95% Vietnamese userbase.
  {{ key: "vietnam",           labelEn: "Vietnam",             labelVi: "Việt Nam",        group: "national" }},
  {{ key: "open",              labelEn: "Open",                labelVi: "Mở rộng",         group: "global" }},
  {{ key: "junior",            labelEn: "Junior",              labelVi: "Trẻ",             group: "global" }},
  {{ key: "asia",              labelEn: "Asia",                labelVi: "Châu Á",          group: "continent" }},
  {{ key: "north-america",     labelEn: "North America",       labelVi: "Bắc Mỹ",          group: "continent" }},
  {{ key: "south-america",     labelEn: "South America",       labelVi: "Nam Mỹ",          group: "continent" }},
  {{ key: "australia-oceania", labelEn: "Australia / Oceania", labelVi: "Úc / Châu Đại Dương", group: "continent" }},
  {{ key: "europe",            labelEn: "Europe",              labelVi: "Châu Âu",         group: "continent" }},
];

export const DUPR_FORMATS: {{ key: DuprFormat; labelEn: string; labelVi: string }}[] = [
  {{ key: "mens-singles",   labelEn: "Men's Singles",   labelVi: "Đơn nam" }},
  {{ key: "womens-singles", labelEn: "Women's Singles", labelVi: "Đơn nữ" }},
  {{ key: "mens-doubles",   labelEn: "Men's Doubles",   labelVi: "Đôi nam" }},
  {{ key: "womens-doubles", labelEn: "Women's Doubles", labelVi: "Đôi nữ" }},
  {{ key: "singles",        labelEn: "Singles",         labelVi: "Đơn" }},
  {{ key: "doubles",        labelEn: "Doubles",         labelVi: "Đôi" }},
];

// Sprint A6 — per-scope format availability. vietnam uses 2 aggregated
// formats; all other scopes use the 4 gender-split formats.
export function getAvailableFormats(scope: DuprScope): DuprFormat[] {{
  if (scope === "vietnam") {{
    return ["doubles", "singles"];
  }}
  return ["mens-singles", "womens-singles", "mens-doubles", "womens-doubles"];
}}

export function defaultFormatForScope(scope: DuprScope): DuprFormat {{
  return scope === "vietnam" ? "doubles" : "mens-doubles";
}}

export const DUPR_LAST_UPDATED = "{today}";
'''

    body = json.dumps(groups, indent=2, ensure_ascii=False) + ";\n"

    OUTPUT.write_text(header + body + footer, encoding="utf-8")

    total = sum(len(v) for g in groups.values() for v in g.values())
    print(f"✓ Wrote {OUTPUT.relative_to(REPO_ROOT)} — {total} player rows across {len(groups)} scopes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
