#!/usr/bin/env python3
"""Read-only GA4 VN cohort snapshot, reusing the existing authenticated adapter."""
import json
import os
import sys
from pathlib import Path

repo = Path(os.environ.get("PICKLEHUB_REPO", str(Path(__file__).resolve().parents[2])))
sys.path.insert(0, str(repo / "scripts/seo"))
import ga4_report as ga4


def main():
    token = ga4.token()
    base = {
        "dateRanges": [{"startDate": "7daysAgo", "endDate": "yesterday", "name": "current"},
                       {"startDate": "14daysAgo", "endDate": "8daysAgo", "name": "previous"}],
        "dimensionFilter": {"filter": {"fieldName": "country", "stringFilter": {"matchType": "EXACT", "value": "Vietnam"}}},
    }
    totals = ga4.run_report(token, {**base, "metrics": [{"name": n} for n in ["activeUsers", "sessions", "engagedSessions", "screenPageViews"]]})
    events = ga4.run_report(token, {**base, "dimensions": [{"name": "eventName"}],
                                  "metrics": [{"name": "eventCount"}, {"name": "totalUsers"}], "limit": 80})
    print(json.dumps({"segment": "country=Vietnam", "totals": totals, "events": events,
                      "limitations": "Event counts are not a sequenced funnel or retention cohorts. Validate event semantics before interpreting conversions."}, ensure_ascii=False))


if __name__ == "__main__":
    main()
