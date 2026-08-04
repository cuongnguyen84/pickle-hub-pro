#!/usr/bin/env python3
# ============================================================================
# Index-coverage classifier — cross-references sitemap inventory, the GSC
# Performance export (Trang.csv), live HTTP status, and (tier 2) the URL
# Inspection API. Built by /idea panel 2026-08-02; design constraints:
#
#   * NEVER prints a coverage label ("Discovered", "404", ...) for a URL it
#     has no per-URL source for. The aggregate Coverage export has counts
#     only — labels invented from it were the #1 failure mode the panel found.
#   * Tier 1 needs no Google credential: sitemap segments x Trang.csv
#     (+ optional --check-http via Googlebot-UA fetches, small batches).
#   * Tier 2 (--inspect) calls the URL Inspection API. coverageState is a
#     LOCALIZED display string (languageCode=vi -> "Đã được gửi và lập chỉ
#     mục"), so requests pin languageCode=en-US and every state is normalized
#     to an internal enum; an unrecognized string is a hard error (exit 4),
#     never a silent "unknown" bucket.
#   * Results cache in sqlite so a rerun resumes instead of re-spending
#     ~7s/URL quota. curl-level timeout per call (requests once hung 449s in
#     panel testing while curl never exceeded 7.5s).
#
# Exit codes (matches gsc_report.py convention, extended):
#   0 ok (including "nothing to report")   2 bad arguments
#   3 missing file / credential            4 schema mismatch / unknown enum
#   5 per-URL source missing for requested labels
#   6 safety gate: refusing an action list that touches URLs with impressions
#
# Usage:
#   python3 scripts/seo/index_coverage.py \
#       --performance-dir ~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-2026-08-01
#   ... --check-http               # + live HTTP status for interesting URLs (<=50)
#   ... --inspect 60               # + URL Inspection for top-N no-impression sitemap URLs
#   ... --urls-file 404s.csv --check-http   # classify an explicit URL list (e.g. GSC 404 export)
#   ... --selftest                 # run built-in assertions, no network
#
# Env: GOOGLE_SA_JSON (default .claude/secrets.local.gsc-ga4-sa.json)
#      GSC_SITE       (default sc-domain:thepicklehub.net — the www URL-prefix
#                      property is siteRestrictedUser and 403s on inspection)
# ============================================================================
import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import sqlite3
import ssl
import subprocess
import sys
import time
import urllib.request

# macOS framework Python ships without system certs (CERTIFICATE_VERIFY_FAILED
# on every https call — also breaks seo_verify.py/canonical_monitor.py). Use
# certifi's bundle when available; the real machine fix is
# "/Applications/Python 3.12/Install Certificates.command".
try:
    import certifi

    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

SITE_ORIGIN = "https://www.thepicklehub.net"
GOOGLEBOT_UA = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)
SA_JSON = os.environ.get("GOOGLE_SA_JSON", ".claude/secrets.local.gsc-ga4-sa.json")
GSC_SITE = os.environ.get("GSC_SITE", "sc-domain:thepicklehub.net")
DB_PATH = os.environ.get(
    "INDEX_COVERAGE_DB", os.path.join(os.path.dirname(__file__), ".index_coverage.sqlite")
)

# Trang.csv headers: Cuong's GSC UI is Vietnamese; accept English too.
# (real 2026-08-01 export header: "Trang hàng đầu" — Top pages)
PAGE_COL = ("Trang hàng đầu", "Trang", "Top pages", "Page")
CLICK_COL = ("Lượt nhấp", "Clicks")
IMPR_COL = ("Lượt hiển thị", "Impressions")

# The aggregate Coverage export ("Vấn đề nghiêm trọng.csv" etc.) has these
# columns — counts per reason, NO URLs. Detecting it => exit 5 with guidance.
AGGREGATE_MARKERS = ("Nguyên nhân", "Lý do", "Reason")

# coverageState (languageCode=en-US) -> internal enum. Unknown string = exit 4.
COVERAGE_ENUM = {
    "Submitted and indexed": "INDEXED",
    "Indexed, not submitted in sitemap": "INDEXED",
    "Discovered - currently not indexed": "DISCOVERED",
    "Discovered – currently not indexed": "DISCOVERED",
    "Crawled - currently not indexed": "CRAWLED_NOT_INDEXED",
    "Crawled – currently not indexed": "CRAWLED_NOT_INDEXED",
    "URL is unknown to Google": "UNKNOWN_TO_GOOGLE",
    "Excluded by 'noindex' tag": "EXCLUDED_NOINDEX",
    "Page with redirect": "REDIRECT",
    "Not found (404)": "NOT_FOUND",
    "Blocked by robots.txt": "ROBOTS_BLOCKED",
    "Soft 404": "SOFT_404",
    "Server error (5xx)": "SERVER_ERROR",
    "Duplicate without user-selected canonical": "DUPLICATE",
    "Duplicate, submitted URL not selected as canonical": "DUPLICATE",
    "Duplicate, Google chose different canonical than user": "DUPLICATE_GOOGLE_CANONICAL",
    "Alternate page with proper canonical tag": "ALTERNATE_CANONICAL",
}

SITEMAP_SEGMENTS = None  # discovered from /sitemap.xml at runtime


def log(msg):
    sys.stderr.write(msg.rstrip() + "\n")


def die(code, msg):
    log(f"ERROR: {msg}")
    sys.exit(code)


# All network I/O shells out to curl: python urllib/requests hang for minutes
# in this environment on connections curl completes in <1s (panel-measured:
# requests hung 449s on a call curl did in 7.4s). curl --max-time is a hard
# wall-clock cap, which stdlib timeouts are not.
def fetch(url, ua=GOOGLEBOT_UA, timeout=30):
    p = subprocess.run(
        ["curl", "-sS", "-A", ua, "--max-time", str(timeout),
         "-w", "\n%{http_code}", url],
        capture_output=True, text=True,
    )
    if p.returncode != 0:
        die(3, f"curl failed for {url}: {p.stderr.strip() or p.returncode}")
    body, _, code = p.stdout.rpartition("\n")
    return int(code or 0), body


def http_status(url, timeout=20):
    """Googlebot-UA status without following redirects (curl doesn't follow without -L)."""
    p = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-A", GOOGLEBOT_UA,
         "--max-time", str(timeout), "-w", "%{http_code}", url],
        capture_output=True, text=True,
    )
    try:
        return int(p.stdout.strip() or 0)
    except ValueError:
        return 0


# ── Trang.csv ────────────────────────────────────────────────────────────────
def pick_col(header, names, path):
    for n in names:
        if n in header:
            return n
    die(4, f"schema mismatch in {path}: none of {names} found. Columns read: {header}")


def load_performance(perf_dir):
    path = os.path.join(perf_dir, "Trang.csv")
    if not os.path.isfile(path):
        alt = os.path.join(perf_dir, "Pages.csv")
        if os.path.isfile(alt):
            path = alt
        elif any(
            os.path.isfile(os.path.join(perf_dir, n))
            for n in ("Vấn đề nghiêm trọng.csv", "Sơ đồ.csv", "Critical issues.csv", "Chart.csv")
        ):
            die(
                5,
                f"{perf_dir} is the COVERAGE export — aggregate counts per reason, no URL column.\n"
                "  The 138 / 42 / 61 URL cohorts are NOT derivable from it.\n"
                "  Pass the Performance-on-Search export instead (contains Trang.csv with URLs).\n"
                "  Per-issue URL lists must be exported one by one from GSC:\n"
                "    Lập chỉ mục → Trang → (click reason row) → Xuất (Indexing → Pages → Export)",
            )
        else:
            die(3, f"Trang.csv not found in {perf_dir}")
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        die(4, f"{path} parsed to zero rows")
    header = list(rows[0].keys())
    if any(m in header for m in AGGREGATE_MARKERS):
        die(
            5,
            f"{path} looks like the aggregate Coverage export — counts per reason, no URL column.\n"
            "  The 138 / 42 / 61 URL cohorts are NOT derivable from that file.\n"
            "  Point --performance-dir at the Performance-on-Search export (has Trang.csv with URLs),\n"
            "  and for per-issue URL lists export each issue from GSC:\n"
            "    Lập chỉ mục → Trang → (click reason row) → Xuất (Indexing → Pages → Export)",
        )
    pcol = pick_col(header, PAGE_COL, path)
    ccol = pick_col(header, CLICK_COL, path)
    icol = pick_col(header, IMPR_COL, path)
    perf = {}
    for r in rows:
        url = (r.get(pcol) or "").strip()
        if not url:
            continue
        perf[url] = {
            "clicks": int(float((r.get(ccol) or "0").replace(",", "") or 0)),
            "impressions": int(float((r.get(icol) or "0").replace(",", "") or 0)),
        }
    # Export date from the directory name, printed first so a stale export is
    # visible immediately (dirs embed the date; an old one still "works").
    m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(os.path.normpath(perf_dir)))
    log(f"performance export: {len(perf)} URLs, export date {m.group(1) if m else 'UNKNOWN (no date in dir name)'}")
    log("note: GSC caps this export at 1000 rows — absence of a URL here means "
        "'unknown', NOT 'zero clicks'.")
    return perf


# ── Sitemaps ─────────────────────────────────────────────────────────────────
def load_sitemaps():
    status, xml = fetch(f"{SITE_ORIGIN}/sitemap.xml")
    if status != 200:
        die(3, f"/sitemap.xml returned {status}")
    children = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    seg_urls = {}
    for child in children:
        seg = child.rsplit("/", 1)[-1]
        s, cxml = fetch(child)
        if s != 200:
            die(3, f"{child} returned {s}")
        seg_urls[seg] = re.findall(
            r"<url[\s>][\s\S]*?<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)", cxml
        )
    total = sum(len(v) for v in seg_urls.values())
    log(f"sitemaps: {len(seg_urls)} segments, {total} URLs")
    return seg_urls


# ── Tier 2: URL Inspection ───────────────────────────────────────────────────
def sa_token():
    if not os.path.isfile(SA_JSON):
        die(
            3,
            f"service account key not found at {SA_JSON}.\n"
            "  Fix: GOOGLE_SA_JSON=/path/to/key.json ... or see scripts/seo/SETUP.md.\n"
            "  Refusing to silently fall back to tier 1 — you asked for --inspect.",
        )
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        die(2, "missing deps for --inspect: pip install google-auth requests --break-system-packages")
    creds = service_account.Credentials.from_service_account_file(
        SA_JSON, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    creds.refresh(Request())
    return creds.token


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inspections ("
        " url TEXT PRIMARY KEY, state TEXT, verdict TEXT, robots TEXT,"
        " google_canonical TEXT, user_canonical TEXT, last_crawl TEXT,"
        " raw_state TEXT, fetched_at TEXT)"
    )
    return conn


def inspect_urls(urls, max_age_days):
    tok = sa_token()
    conn = db_conn()
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max_age_days)).isoformat()
    out, todo = {}, []
    for u in urls:
        row = conn.execute(
            "SELECT state, verdict, robots, google_canonical, user_canonical,"
            " last_crawl, fetched_at FROM inspections WHERE url=?", (u,)
        ).fetchone()
        if row and row[6] and row[6] > cutoff:
            out[u] = {"state": row[0], "verdict": row[1], "robots": row[2],
                      "google_canonical": row[3], "user_canonical": row[4],
                      "last_crawl": row[5], "cached": True}
        else:
            todo.append(u)
    log(f"inspect: {len(out)} cached, {len(todo)} live calls (~{len(todo) * 7}s)")
    for i, u in enumerate(todo, 1):
        body = json.dumps(
            {"inspectionUrl": u, "siteUrl": GSC_SITE, "languageCode": "en-US"}
        ).encode()
        p = subprocess.run(
            ["curl", "-sS", "--max-time", "30", "-X", "POST",
             "-H", f"Authorization: Bearer {tok}",
             "-H", "Content-Type: application/json",
             "-d", body.decode(),
             "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"],
            capture_output=True, text=True,
        )
        try:
            if p.returncode != 0:
                raise RuntimeError(p.stderr.strip() or f"curl exit {p.returncode}")
            data = json.loads(p.stdout)
        except Exception as e:
            log(f"  [{i}/{len(todo)}] {u} -> transport error ({e}); saved progress, rerun to resume")
            continue
        isr = data.get("inspectionResult", {}).get("indexStatusResult", {})
        raw_state = isr.get("coverageState", "")
        if raw_state and raw_state not in COVERAGE_ENUM:
            conn.commit()
            die(
                4,
                f"unrecognized coverageState {raw_state!r} for {u} — refusing to bucket it "
                "silently. Add it to COVERAGE_ENUM (check languageCode pinning first).",
            )
        rec = {
            "state": COVERAGE_ENUM.get(raw_state, "NO_STATE"),
            "verdict": isr.get("verdict", ""),
            "robots": isr.get("robotsTxtState", ""),
            "google_canonical": isr.get("googleCanonical", ""),
            "user_canonical": isr.get("userCanonical", ""),
            "last_crawl": isr.get("lastCrawlTime", ""),
            "cached": False,
        }
        conn.execute(
            "INSERT OR REPLACE INTO inspections VALUES (?,?,?,?,?,?,?,?,?)",
            (u, rec["state"], rec["verdict"], rec["robots"], rec["google_canonical"],
             rec["user_canonical"], rec["last_crawl"], raw_state,
             dt.datetime.now(dt.timezone.utc).isoformat()),
        )
        conn.commit()
        out[u] = rec
        log(f"  [{i}/{len(todo)}] {rec['state']:<22} {u}")
        time.sleep(0.3)
    conn.close()
    return out


# ── Selftest ─────────────────────────────────────────────────────────────────
def selftest():
    # enum map covers both hyphen variants GSC has been seen emitting
    assert COVERAGE_ENUM["Discovered - currently not indexed"] == "DISCOVERED"
    assert COVERAGE_ENUM["Crawled – currently not indexed"] == "CRAWLED_NOT_INDEXED"
    assert "Đã được gửi và lập chỉ mục" not in COVERAGE_ENUM  # vi strings must NOT be accepted
    # Trang.csv parser: real VN headers from the 2026-08-01 export, comma thousands
    fixture = "Trang hàng đầu,Lượt nhấp,Lượt hiển thị,CTR,Vị trí\nhttps://x/a,12,\"1,234\",1%,5\n"
    rows = list(csv.DictReader(io.StringIO(fixture)))
    assert pick_col(list(rows[0].keys()), PAGE_COL, "fixture") == "Trang hàng đầu"
    assert int(float(rows[0]["Lượt hiển thị"].replace(",", ""))) == 1234
    # aggregate detection marker present in the real Coverage export header
    assert any(m in ("Nguyên nhân", "Nguồn", "Xác thực", "Trang") for m in AGGREGATE_MARKERS)
    print("selftest OK")


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Index-coverage classifier (tier1 offline, tier2 --inspect)")
    ap.add_argument("--performance-dir", help="GSC Performance-on-Search export dir (REQUIRED — no auto-guess)")
    ap.add_argument("--urls-file", help="CSV/plain list of URLs to classify (e.g. per-issue GSC export)")
    ap.add_argument("--check-http", action="store_true", help="fetch live Googlebot-UA HTTP status")
    ap.add_argument("--limit", type=int, default=50, help="max live HTTP checks per run (default 50)")
    ap.add_argument("--inspect", type=int, metavar="N", help="URL Inspection API for top-N no-impression sitemap URLs (or all of --urls-file)")
    ap.add_argument("--max-age", type=int, default=7, help="days before a cached inspection goes stale")
    ap.add_argument("--force", action="store_true", help="override the impressions>0 safety gate")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        selftest()
        return

    if not args.performance_dir:
        ap.print_usage(sys.stderr)
        die(2, "--performance-dir is required (no auto-guess: a stale export looks identical to a fresh one).\n"
               "  Hint: ls -d ~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-*")
    perf = load_performance(os.path.expanduser(args.performance_dir))
    seg_urls = load_sitemaps()
    in_sitemap = {u: seg for seg, urls in seg_urls.items() for u in urls}

    explicit = []
    if args.urls_file:
        p = os.path.expanduser(args.urls_file)
        if not os.path.isfile(p):
            die(3, f"{p} not found")
        with open(p, newline="", encoding="utf-8-sig") as f:
            sniff = f.read(4096)
            f.seek(0)
            if "," in sniff.splitlines()[0]:
                rows = list(csv.DictReader(f))
                col = pick_col(list(rows[0].keys()), PAGE_COL + ("URL", "url"), p)
                explicit = [r[col].strip() for r in rows if r.get(col, "").strip()]
            else:
                explicit = [l.strip() for l in f if l.strip().startswith("http")]
        log(f"urls-file: {len(explicit)} URLs")

    # Tier-1 cross-reference. Three independent columns; NO coverage labels.
    orphans = [u for u in perf if u not in in_sitemap and u.startswith(SITE_ORIGIN)]
    no_impression = [u for u in in_sitemap if u not in perf]
    report = {
        "site": SITE_ORIGIN,
        "segments": {seg: len(urls) for seg, urls in seg_urls.items()},
        "performance_urls": len(perf),
        "in_sitemap_with_impressions": sum(1 for u in in_sitemap if u in perf),
        "in_sitemap_no_impression_UNKNOWN_STATUS": len(no_impression),
        "in_performance_not_in_sitemap": sorted(
            orphans, key=lambda u: -perf[u]["impressions"]
        )[:100],
        "note": "no_impression means NO PER-URL SOURCE — it is NOT a 'not indexed' label. "
                "Use --inspect for real coverage states.",
    }

    targets = explicit or []
    if args.check_http:
        pool = targets or (report["in_performance_not_in_sitemap"][: args.limit])
        checked = {}
        for u in pool[: args.limit]:
            checked[u] = http_status(u)
            log(f"  http {checked[u]:>3} {u}")
        report["http_status"] = checked
        if len(pool) > args.limit:
            log(f"http checks capped at --limit {args.limit}; {len(pool) - args.limit} URLs NOT checked (not silently OK)")

    if args.inspect:
        pool = targets or sorted(no_impression)[: args.inspect]
        # Safety gate: an inspection list is often the seed of an action list
        # (noindex/410). URLs with real impressions must never ride along
        # unnoticed.
        hot = [u for u in pool if perf.get(u, {}).get("impressions", 0) > 0]
        if hot and not args.force:
            for u in hot[:10]:
                log(f"  {perf[u]['impressions']:>6} impr  {perf[u]['clicks']:>4} clicks  {u}")
            die(6, f"{len(hot)} candidate URLs have search impressions. Zero clicks is not "
                   "evidence of thin content; thin-ness is defined ONLY by isThinVenue() "
                   "(functions/_lib/render/venues.ts). Rerun with --force if intentional.")
        report["inspections"] = inspect_urls(pool[: args.inspect], args.max_age)
        counts = {}
        for r in report["inspections"].values():
            counts[r["state"]] = counts.get(r["state"], 0) + 1
        report["inspection_summary"] = counts

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
