#!/usr/bin/env python3
# ============================================================================
# GSC (Google Search Console) report — free replacement for Ahrefs gsc-* tools
# ============================================================================
# Queries the Search Analytics API for thepicklehub.net and prints a JSON
# summary: totals + WoW deltas, top queries, top pages, and biggest movers
# (pages/queries losing clicks). Read-only. No data is written anywhere.
#
# Auth: a Google service account JSON key whose email has been granted access
#       in GSC (Settings -> Users and permissions).
#
# Env vars:
#   GOOGLE_SA_JSON   path to the service account key
#                    (default: .claude/secrets.local.gsc-ga4-sa.json)
#   GSC_SITE         Search Console property. For a Domain property use
#                    "sc-domain:thepicklehub.net" (default). For a URL-prefix
#                    property use "https://www.thepicklehub.net/".
#
# Usage:
#   python3 scripts/seo/gsc_report.py                  # last 7d vs prev 7d
#   python3 scripts/seo/gsc_report.py --days 28
#   GSC_SITE="https://www.thepicklehub.net/" python3 scripts/seo/gsc_report.py
#
# Deps: pip install google-auth requests --break-system-packages
# ============================================================================
import argparse
import datetime as dt
import json
import os
import sys
from urllib.parse import quote

try:
    import requests
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
except ImportError:
    sys.stderr.write(
        "Missing deps. Run: pip install google-auth requests --break-system-packages\n"
    )
    sys.exit(2)

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
SA_JSON = os.environ.get("GOOGLE_SA_JSON", ".claude/secrets.local.gsc-ga4-sa.json")
# Default to the URL-prefix property. The service account is granted access
# on the URL-prefix property only; the sc-domain property returns 403
# ("User does not have sufficient permission"). Override via GSC_SITE once the
# SA email is added to the Domain property in GSC > Settings > Users.
SITE = os.environ.get("GSC_SITE", "https://www.thepicklehub.net/")


def token():
    if not os.path.exists(SA_JSON):
        sys.stderr.write(
            f"Service account key not found at {SA_JSON}. "
            "See scripts/seo/SETUP.md\n"
        )
        sys.exit(3)
    creds = service_account.Credentials.from_service_account_file(
        SA_JSON, scopes=[SCOPE]
    )
    creds.refresh(Request())
    return creds.token


def query(tok, start, end, dimensions, row_limit=25):
    url = (
        "https://searchconsole.googleapis.com/webmasters/v3/sites/"
        f"{quote(SITE, safe='')}/searchAnalytics/query"
    )
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": dimensions,
        "rowLimit": row_limit,
        "dataState": "all",
    }
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if r.status_code != 200:
        sys.stderr.write(f"GSC API error {r.status_code}: {r.text[:400]}\n")
        sys.exit(4)
    return r.json().get("rows", [])


def totals(rows):
    return {
        "clicks": round(sum(x.get("clicks", 0) for x in rows)),
        "impressions": round(sum(x.get("impressions", 0) for x in rows)),
    }


def pct(cur, prev):
    if prev == 0:
        return None if cur == 0 else 100.0
    return round((cur - prev) / prev * 100, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--limit", type=int, default=25)
    args = ap.parse_args()

    # GSC data lags ~2-3 days; end the window 3 days back to avoid partials.
    today = dt.date.today()
    cur_end = today - dt.timedelta(days=3)
    cur_start = cur_end - dt.timedelta(days=args.days - 1)
    prev_end = cur_start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=args.days - 1)

    iso = lambda d: d.isoformat()
    tok = token()

    cur_q = query(tok, iso(cur_start), iso(cur_end), ["query"], args.limit)
    prev_q = query(tok, iso(prev_start), iso(prev_end), ["query"], 1000)
    cur_p = query(tok, iso(cur_start), iso(cur_end), ["page"], args.limit)
    prev_p = query(tok, iso(prev_start), iso(prev_end), ["page"], 1000)

    prev_q_map = {r["keys"][0]: r for r in prev_q}
    prev_p_map = {r["keys"][0]: r for r in prev_p}

    # Movers: pages whose clicks dropped most vs previous window.
    losers = []
    for r in prev_p:
        key = r["keys"][0]
        prev_c = r.get("clicks", 0)
        cur_c = next(
            (x.get("clicks", 0) for x in cur_p if x["keys"][0] == key), 0
        )
        if prev_c >= 1 and cur_c < prev_c:
            losers.append(
                {"page": key, "clicks_prev": round(prev_c), "clicks_now": round(cur_c),
                 "delta": round(cur_c - prev_c)}
            )
    losers.sort(key=lambda x: x["delta"])

    def fmt(rows, kind):
        out = []
        for r in rows:
            out.append({
                kind: r["keys"][0],
                "clicks": round(r.get("clicks", 0)),
                "impressions": round(r.get("impressions", 0)),
                "ctr": round(r.get("ctr", 0) * 100, 2),
                "position": round(r.get("position", 0), 1),
            })
        return out

    report = {
        "site": SITE,
        "window": {"current": [iso(cur_start), iso(cur_end)],
                   "previous": [iso(prev_start), iso(prev_end)]},
        "totals": {
            "current": totals(cur_q),
            "previous": totals(prev_q),
        },
        "wow_pct": {
            "clicks": pct(totals(cur_q)["clicks"], totals(prev_q)["clicks"]),
            "impressions": pct(totals(cur_q)["impressions"], totals(prev_q)["impressions"]),
        },
        "top_queries": fmt(cur_q, "query"),
        "top_pages": fmt(cur_p, "page"),
        "pages_losing_clicks": losers[:15],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
