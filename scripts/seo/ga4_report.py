#!/usr/bin/env python3
# ============================================================================
# GA4 report — free replacement for Ahrefs web-analytics-* tools
# ============================================================================
# Queries the GA4 Data API (runReport) for thepicklehub.net and prints a JSON
# summary: sessions / users / pageviews with WoW deltas, top pages, source
# channels, and countries. Read-only.
#
# Auth: same service account as gsc_report.py, granted Viewer on the GA4
#       property (Admin -> Property Access Management).
#
# Env vars:
#   GOOGLE_SA_JSON    path to the service account key
#                     (default: .claude/secrets.local.gsc-ga4-sa.json)
#   GA4_PROPERTY_ID   numeric GA4 property id (e.g. 123456789) — REQUIRED.
#                     Find it in GA4 Admin -> Property Settings -> Property ID.
#                     (Note: this is NOT the G-XXXX measurement id.)
#
# Usage:
#   GA4_PROPERTY_ID=123456789 python3 scripts/seo/ga4_report.py
#   GA4_PROPERTY_ID=123456789 python3 scripts/seo/ga4_report.py --days 7
#
# Deps: pip install google-auth requests --break-system-packages
# ============================================================================
import argparse
import datetime as dt
import json
import os
import sys

try:
    import requests
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
except ImportError:
    sys.stderr.write(
        "Missing deps. Run: pip install google-auth requests --break-system-packages\n"
    )
    sys.exit(2)

SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
SA_JSON = os.environ.get("GOOGLE_SA_JSON", ".claude/secrets.local.gsc-ga4-sa.json")
PROP = os.environ.get("GA4_PROPERTY_ID", "").strip()


def token():
    if not os.path.exists(SA_JSON):
        sys.stderr.write(f"Service account key not found at {SA_JSON}. See scripts/seo/SETUP.md\n")
        sys.exit(3)
    creds = service_account.Credentials.from_service_account_file(SA_JSON, scopes=[SCOPE])
    creds.refresh(Request())
    return creds.token


def run_report(tok, body):
    url = f"https://analyticsdata.googleapis.com/v1beta/properties/{PROP}:runReport"
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if r.status_code != 200:
        sys.stderr.write(f"GA4 API error {r.status_code}: {r.text[:400]}\n")
        sys.exit(4)
    return r.json()


def pct(cur, prev):
    if prev == 0:
        return None if cur == 0 else 100.0
    return round((cur - prev) / prev * 100, 1)


def breakdown(tok, dim, start, end, limit=10):
    data = run_report(tok, {
        "dateRanges": [{"startDate": start, "endDate": end}],
        "dimensions": [{"name": dim}],
        "metrics": [{"name": "sessions"}],
        "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
        "limit": limit,
    })
    out = []
    for row in data.get("rows", []):
        out.append({
            dim: row["dimensionValues"][0]["value"],
            "sessions": int(row["metricValues"][0]["value"]),
        })
    return out


def main():
    if not PROP:
        sys.stderr.write("GA4_PROPERTY_ID env var is required. See scripts/seo/SETUP.md\n")
        sys.exit(5)

    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    args = ap.parse_args()

    today = dt.date.today()
    cur_end = today - dt.timedelta(days=1)
    cur_start = cur_end - dt.timedelta(days=args.days - 1)
    prev_end = cur_start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=args.days - 1)
    iso = lambda d: d.isoformat()

    tok = token()

    totals = run_report(tok, {
        "dateRanges": [
            {"startDate": iso(cur_start), "endDate": iso(cur_end), "name": "current"},
            {"startDate": iso(prev_start), "endDate": iso(prev_end), "name": "previous"},
        ],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalUsers"},
            {"name": "screenPageViews"},
            {"name": "engagementRate"},
        ],
        # With >1 dateRange, GA4 auto-adds a reserved "dateRange" dimension
        # (values date_range_0 / date_range_1) to each row. It must NOT be
        # listed in "dimensions" or the API returns 400 INVALID_ARGUMENT.
    })

    cur = prev = None
    for row in totals.get("rows", []):
        vals = [m["value"] for m in row["metricValues"]]
        rec = {
            "sessions": int(float(vals[0])),
            "users": int(float(vals[1])),
            "pageviews": int(float(vals[2])),
            "engagement_rate": round(float(vals[3]) * 100, 1),
        }
        # The auto dateRange dimension echoes the range *name* we set
        # ("current"/"previous"), not "date_range_0/1".
        if row["dimensionValues"][0]["value"] == "current":
            cur = rec
        else:
            prev = rec
    cur = cur or {"sessions": 0, "users": 0, "pageviews": 0, "engagement_rate": 0}
    prev = prev or {"sessions": 0, "users": 0, "pageviews": 0, "engagement_rate": 0}

    report = {
        "property": PROP,
        "window": {"current": [iso(cur_start), iso(cur_end)],
                   "previous": [iso(prev_start), iso(prev_end)]},
        "totals": {"current": cur, "previous": prev},
        "wow_pct": {
            "sessions": pct(cur["sessions"], prev["sessions"]),
            "users": pct(cur["users"], prev["users"]),
            "pageviews": pct(cur["pageviews"], prev["pageviews"]),
        },
        "top_pages": breakdown(tok, "pagePath", iso(cur_start), iso(cur_end)),
        "source_channels": breakdown(tok, "sessionDefaultChannelGroup", iso(cur_start), iso(cur_end)),
        "countries": breakdown(tok, "country", iso(cur_start), iso(cur_end)),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
