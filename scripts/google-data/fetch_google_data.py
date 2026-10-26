#!/usr/bin/env python3
"""Fetch Google Search Console + GA4 snapshots for thepicklehub.net.

Runs ON Cường's Mac (the service-account key never leaves the machine).
A launchd job runs it every Monday ~07:15 VN, ahead of the 08:00 SEO
weekly report; it can also be run by hand (see README.md in this folder).

What it does:
  * GSC Search Analytics for sc-domain:thepicklehub.net — last 28 days
    (ending 2 days ago; GSC data lags) plus the previous 28 days:
    totals, a per-day series, top queries, top pages, and the pages
    losing the most clicks.
  * GA4 Data API for property 522556358 — last 28 days (ending yesterday):
    sessions/users/views per day, top pages, top channels.
  * Writes data/google/gsc-<run-date>.json and data/google/ga4-<run-date>.json
    in the repo and commits + pushes ONLY those two files (pathspec commit,
    so unrelated dirty files in the working tree never block or leak in).
    A push failure is loud: stderr message + exit code 3.

The key is read from .claude/secrets.local.gsc-ga4-sa.json in the repo by
default (override with --key or $GOOGLE_DATA_SA_KEY). The key material is
never printed.

--selftest: authenticate, list the GSC properties the service account can
see, and read GA4 property metadata — the quick permission check to run
right after access is granted. Exits 0 only if both APIs answer.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

GSC_PROPERTY = "sc-domain:thepicklehub.net"
GA4_PROPERTY = "522556358"
GSC_API = "https://www.googleapis.com/webmasters/v3"
GA4_API = "https://analyticsdata.googleapis.com/v1beta"
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly",
          "https://www.googleapis.com/auth/analytics.readonly"]
VN = ZoneInfo("Asia/Ho_Chi_Minh")
PERIOD_DAYS = 28
GSC_LAG_DAYS = 2   # Search Console data is typically final after ~2-3 days.
GA4_LAG_DAYS = 1


# ---------------------------------------------------------------- periods
def gsc_periods(today: date) -> tuple[tuple[date, date], tuple[date, date]]:
    """((cur_start, cur_end), (prev_start, prev_end)) for Search Console."""
    end = today - timedelta(days=GSC_LAG_DAYS)
    start = end - timedelta(days=PERIOD_DAYS - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=PERIOD_DAYS - 1)
    return (start, end), (prev_start, prev_end)


def ga4_period(today: date) -> tuple[date, date]:
    end = today - timedelta(days=GA4_LAG_DAYS)
    return end - timedelta(days=PERIOD_DAYS - 1), end


# ------------------------------------------------------------ HTTP + auth
def _ensure_ca_bundle() -> None:
    """Point OpenSSL at certifi's CA bundle when the platform has none.

    macOS python.org builds ship without a populated CA bundle, so every
    HTTPS call dies with CERTIFICATE_VERIFY_FAILED — exactly what the first
    --selftest on the Mac hit, in launchd's clean environment where no
    shell profile sets SSL_CERT_FILE. run.sh exports it too; doing it here
    as well keeps direct `python3 fetch_google_data.py` runs working.
    """
    current = os.environ.get("SSL_CERT_FILE")
    if current and Path(current).exists():
        return
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except Exception:  # noqa: BLE001 - no certifi: leave the platform default
        pass


def _credentials(key_path: Path):
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    creds = service_account.Credentials.from_service_account_file(str(key_path), scopes=SCOPES)
    creds.refresh(Request())
    return creds


def _api_json(creds, method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read() or b"{}")


# ------------------------------------------------------------------- GSC
def gsc_query_body(start: date, end: date, dimensions: list[str], row_limit: int) -> dict:
    return {"startDate": start.isoformat(), "endDate": end.isoformat(),
            "dimensions": dimensions, "rowLimit": row_limit, "dataState": "final"}


def _gsc_rows(creds, start: date, end: date, dimensions: list[str], row_limit: int) -> list[dict]:
    prop = urllib.parse.quote(GSC_PROPERTY, safe="")
    out = _api_json(creds, "POST", f"{GSC_API}/sites/{prop}/searchAnalytics/query",
                    gsc_query_body(start, end, dimensions, row_limit))
    return out.get("rows", [])


def _gsc_totals(creds, start: date, end: date) -> dict:
    rows = _gsc_rows(creds, start, end, [], 1)
    if not rows:
        return {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0}
    r = rows[0]
    return {"clicks": r.get("clicks", 0), "impressions": r.get("impressions", 0),
            "ctr": round(r.get("ctr", 0.0), 4), "position": round(r.get("position", 0.0), 2)}


def _gsc_daily(creds, start: date, end: date) -> list[dict]:
    """Per-day series for the same window as the totals (dimensions=['date']).

    Sorted ascending by date here — the API does not guarantee row order —
    so week-over-week movement can be read straight off the snapshot.
    """
    rows = _gsc_rows(creds, start, end, ["date"], PERIOD_DAYS + 2)
    return [{"date": r["keys"][0], "clicks": r.get("clicks", 0),
             "impressions": r.get("impressions", 0), "ctr": round(r.get("ctr", 0.0), 4),
             "position": round(r.get("position", 0.0), 2)}
            for r in sorted(rows, key=lambda r: r["keys"][0])]


def losing_pages(current_rows: list[dict], previous_rows: list[dict], limit: int = 15) -> list[dict]:
    """Pages with the biggest click drop, current period vs previous."""
    prev = {r["keys"][0]: r for r in previous_rows}
    out = []
    for r in current_rows:
        page = r["keys"][0]
        before = prev.get(page, {}).get("clicks", 0)
        delta = r.get("clicks", 0) - before
        if delta < 0:
            out.append({"page": page, "clicks": r.get("clicks", 0), "previous_clicks": before,
                        "delta": delta, "impressions": r.get("impressions", 0)})
    for page, r in prev.items():
        if page not in {c["keys"][0] for c in current_rows} and r.get("clicks", 0) > 0:
            out.append({"page": page, "clicks": 0, "previous_clicks": r["clicks"],
                        "delta": -r["clicks"], "impressions": 0})
    return sorted(out, key=lambda x: x["delta"])[:limit]


def build_gsc_snapshot(creds, today: date) -> dict:
    (start, end), (pstart, pend) = gsc_periods(today)
    totals = _gsc_totals(creds, start, end)
    previous = _gsc_totals(creds, pstart, pend)
    queries = [{"query": r["keys"][0], "clicks": r.get("clicks", 0),
                "impressions": r.get("impressions", 0), "ctr": round(r.get("ctr", 0.0), 4),
                "position": round(r.get("position", 0.0), 2)}
               for r in _gsc_rows(creds, start, end, ["query"], 25)]
    pages_now = _gsc_rows(creds, start, end, ["page"], 1000)
    pages_prev = _gsc_rows(creds, pstart, pend, ["page"], 1000)
    top_pages = [{"page": r["keys"][0], "clicks": r.get("clicks", 0),
                  "impressions": r.get("impressions", 0), "ctr": round(r.get("ctr", 0.0), 4),
                  "position": round(r.get("position", 0.0), 2)}
                 for r in sorted(pages_now, key=lambda r: -r.get("clicks", 0))[:25]]
    return {
        "source": "google-search-console", "property": GSC_PROPERTY,
        "generated_at": datetime.now(VN).isoformat(),
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": PERIOD_DAYS},
        "previous_period": {"start": pstart.isoformat(), "end": pend.isoformat()},
        "totals": totals, "previous_totals": previous,
        "daily": _gsc_daily(creds, start, end),
        "top_queries": queries, "top_pages": top_pages,
        "losing_pages": losing_pages(pages_now, pages_prev),
    }


# ------------------------------------------------------------------- GA4
def ga4_report_body(start: date, end: date, dimensions: list[str], metrics: list[str],
                    order_metric: str | None = None, limit: int = 10000) -> dict:
    body = {"dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
            "dimensions": [{"name": d} for d in dimensions],
            "metrics": [{"name": m} for m in metrics], "limit": limit}
    if order_metric:
        body["orderBys"] = [{"metric": {"metricName": order_metric}, "desc": True}]
    return body


def _ga4_rows(creds, start: date, end: date, dimensions: list[str], metrics: list[str],
              order_metric: str | None = None, limit: int = 10000) -> list[dict]:
    out = _api_json(creds, "POST", f"{GA4_API}/properties/{GA4_PROPERTY}:runReport",
                    ga4_report_body(start, end, dimensions, metrics, order_metric, limit))
    rows = []
    for row in out.get("rows", []):
        item = {dimensions[i]: v.get("value", "") for i, v in enumerate(row.get("dimensionValues", []))}
        for i, m in enumerate(metrics):
            raw = row.get("metricValues", [])[i].get("value", "0")
            item[m] = float(raw) if ("." in raw or "e" in raw.lower()) else int(raw)
        rows.append(item)
    return rows


def build_ga4_snapshot(creds, today: date) -> dict:
    start, end = ga4_period(today)
    daily = sorted(_ga4_rows(creds, start, end, ["date"], ["sessions", "totalUsers", "screenPageViews"]),
                   key=lambda r: r["date"])
    top_pages = _ga4_rows(creds, start, end, ["pagePath"], ["screenPageViews", "sessions"],
                          order_metric="screenPageViews", limit=25)
    channels = _ga4_rows(creds, start, end, ["sessionDefaultChannelGroup"], ["sessions", "totalUsers"],
                         order_metric="sessions", limit=25)
    return {
        "source": "ga4", "property": GA4_PROPERTY,
        "generated_at": datetime.now(VN).isoformat(),
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": PERIOD_DAYS},
        "totals": {"sessions": sum(r["sessions"] for r in daily),
                   "users": sum(r["totalUsers"] for r in daily),
                   "views": sum(r["screenPageViews"] for r in daily)},
        "daily": daily, "top_pages": top_pages, "top_channels": channels,
    }


# -------------------------------------------------------------- git write
class GitPushError(RuntimeError):
    """Committing or pushing the snapshot files failed."""


def commit_snapshots(repo: Path, files: list[Path], run_date: date) -> str:
    """Commit ONLY the snapshot files (pathspec commit) and push.

    Returns 'committed', or 'unchanged' when the snapshots are identical to
    what is already committed. Raises GitPushError on any git failure so the
    caller can exit loudly instead of swallowing it.
    """
    rel = [str(f.relative_to(repo)) for f in files]
    add = subprocess.run(["git", "-C", str(repo), "add", "--", *rel], capture_output=True, text=True)
    if add.returncode:
        raise GitPushError(f"git add failed: {add.stderr.strip()[:300]}")
    staged = subprocess.run(["git", "-C", str(repo), "diff", "--cached", "--quiet", "--", *rel],
                            capture_output=True, text=True)
    if staged.returncode == 0:
        return "unchanged"
    commit = subprocess.run(["git", "-C", str(repo), "commit", "-m",
                             f"data(google): GSC/GA4 snapshot {run_date.isoformat()}", "--", *rel],
                            capture_output=True, text=True)
    if commit.returncode:
        raise GitPushError(f"git commit failed: {(commit.stderr or commit.stdout).strip()[:300]}")
    push = subprocess.run(["git", "-C", str(repo), "push", "origin", "HEAD:main"],
                          capture_output=True, text=True)
    if push.returncode:
        raise GitPushError(f"git push failed (snapshot committed locally, NOT pushed): {push.stderr.strip()[:300]}")
    return "committed"


# --------------------------------------------------------------- selftest
def selftest(creds) -> int:
    ok = True
    try:
        sites = _api_json(creds, "GET", f"{GSC_API}/sites")
        entries = sites.get("siteEntry", [])
        print(f"GSC: OK — service account sees {len(entries)} propert(ies):")
        for e in entries:
            print(f"  - {e.get('siteUrl')} (permission: {e.get('permissionLevel')})")
        if not any(e.get("siteUrl") == GSC_PROPERTY for e in entries):
            print(f"  ! {GSC_PROPERTY} NOT in the list — the SA needs to be added to this property (Restricted is enough).")
            ok = False
    except Exception as exc:  # noqa: BLE001 - report and continue to the GA4 check
        print(f"GSC: FAILED — {type(exc).__name__}: {exc}")
        ok = False
    try:
        meta = _api_json(creds, "GET", f"{GA4_API}/properties/{GA4_PROPERTY}/metadata")
        dims = len(meta.get("dimensions", [])); mets = len(meta.get("metrics", []))
        print(f"GA4: OK — property {GA4_PROPERTY} metadata readable ({dims} dimensions, {mets} metrics).")
    except Exception as exc:  # noqa: BLE001
        print(f"GA4: FAILED — {type(exc).__name__}: {exc}")
        ok = False
    print("SELFTEST:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


# ------------------------------------------------------------------- main
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--selftest", action="store_true", help="check API access only; write nothing")
    ap.add_argument("--key", type=Path, default=None, help="service-account JSON path")
    ap.add_argument("--repo", type=Path, default=None, help="repo root (default: the repo containing this script)")
    ap.add_argument("--no-commit", action="store_true", help="write snapshots but do not commit/push")
    args = ap.parse_args(argv)
    _ensure_ca_bundle()

    repo = (args.repo or Path(__file__).resolve().parents[2]).resolve()
    key = args.key or Path(os.environ.get("GOOGLE_DATA_SA_KEY", repo / ".claude/secrets.local.gsc-ga4-sa.json"))
    if not key.exists():
        print(f"ERROR: service-account key not found at {key}", file=sys.stderr)
        return 2
    creds = _credentials(key)
    if args.selftest:
        return selftest(creds)

    today = datetime.now(VN).date()
    out_dir = repo / "data/google"
    out_dir.mkdir(parents=True, exist_ok=True)
    gsc_file = out_dir / f"gsc-{today.isoformat()}.json"
    ga4_file = out_dir / f"ga4-{today.isoformat()}.json"
    gsc_file.write_text(json.dumps(build_gsc_snapshot(creds, today), ensure_ascii=False, indent=1) + "\n")
    ga4_file.write_text(json.dumps(build_ga4_snapshot(creds, today), ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {gsc_file.relative_to(repo)} and {ga4_file.relative_to(repo)}")
    if args.no_commit:
        return 0
    try:
        outcome = commit_snapshots(repo, [gsc_file, ga4_file], today)
    except GitPushError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 3
    print(f"git: {outcome}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
