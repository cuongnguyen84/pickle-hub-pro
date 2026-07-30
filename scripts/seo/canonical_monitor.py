#!/usr/bin/env python3
# ============================================================================
# canonical_monitor.py — synthetic prerender canonical-poisoning detector
# ============================================================================
# Curls a curated list of production routes as Googlebot and verifies each
# returns its OWN canonical (self-referencing) — catching the cross-route
# "canonical poisoning" incident where unrelated routes briefly served one
# venue page's full SEO surface (title/canonical/og/hreflang) to bots.
#
# Two independent checks:
#   1. Per-route self-canonical: for the curated SELF_CANONICAL routes, the
#      <link rel="canonical"> path must equal the requested path.
#   2. Collision check: no two DISTINCT requested paths may resolve to the
#      SAME canonical (the poisoning signature was N routes -> 1 canonical).
#
# Read-only. Exits non-zero if poisoning is detected. Optionally fires a
# Telegram alert (reuses scripts/ops/notify_telegram.py if present).
#
# Intentionally stdlib-only (urllib) so it runs in CI, cron, or a Cowork
# scheduled task with no pip install.
#
# Usage:
#   python3 canonical_monitor.py                 # check, print, exit code
#   python3 canonical_monitor.py --alert         # + Telegram on failure
#   python3 canonical_monitor.py --rounds 3      # repeat to catch flaky window
#   BASE_URL=https://feat.pickle-hub-pro.pages.dev python3 canonical_monitor.py
# ============================================================================
import argparse
import os
import re
import subprocess
import sys
import time
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "https://www.thepicklehub.net").rstrip("/")
GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

# Curated routes that are KNOWN to be self-canonical (canonical == own path).
# Deliberately excludes /vi/tournament, /vi/org, /vi/tran-dau, /vi/live — those
# declare an EN canonical BY DESIGN (see CLAUDE.md), so they are not valid
# self-canonical probes. Keep this list to stable, indexable surfaces.
SELF_CANONICAL = [
    "/",
    "/blog",
    "/vi/blog",
    "/news",
    "/rankings",
    "/live",
    "/tools",
    # A few stable content pages (update if slugs are retired):
    "/blog/singapore-open-2026-preview",
    "/vi/blog/thuat-ngu-pickleball",
    "/tournament/mlp-san-diego",
]

CANON_RE = re.compile(
    r'<link[^>]+rel="canonical"[^>]*href="([^"]+)"', re.IGNORECASE
)


def fetch(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={
        "User-Agent": GOOGLEBOT_UA,
        "Accept": "text/html",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        html = r.read().decode("utf-8", "replace")
    return html


def canon_path(html):
    m = CANON_RE.search(html)
    if not m:
        return None
    href = m.group(1)
    p = re.sub(r"^https?://[^/]+", "", href)
    return p or "/"


def check_once():
    results = {}
    for path in SELF_CANONICAL:
        try:
            results[path] = canon_path(fetch(path))
        except Exception as e:  # noqa
            results[path] = f"ERR:{type(e).__name__}"
    return results


def evaluate(results):
    failures = []

    # 1. self-canonical check
    for path, canon in results.items():
        if canon is None:
            failures.append(f"MISSING canonical: {path}")
        elif str(canon).startswith("ERR:"):
            failures.append(f"FETCH {canon}: {path}")
        elif canon != path:
            failures.append(f"MISMATCH: {path} -> canonical {canon}")

    # 2. collision check (distinct paths sharing one canonical = poisoning)
    seen = {}
    for path, canon in results.items():
        if not canon or str(canon).startswith("ERR:"):
            continue
        seen.setdefault(canon, []).append(path)
    for canon, paths in seen.items():
        if len(paths) > 1:
            failures.append(f"COLLISION: {len(paths)} routes -> {canon}: {paths}")

    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=1,
                    help="repeat N times (poisoning is intermittent)")
    ap.add_argument("--sleep", type=float, default=2.0)
    ap.add_argument("--alert", action="store_true",
                    help="fire Telegram alert on failure")
    args = ap.parse_args()

    all_failures = []
    for i in range(args.rounds):
        failures = evaluate(check_once())
        if failures:
            all_failures.extend(f"[round {i+1}] {x}" for x in failures)
        if i < args.rounds - 1:
            time.sleep(args.sleep)

    if not all_failures:
        print(f"OK — {len(SELF_CANONICAL)} routes self-canonical, no collisions "
              f"({args.rounds} round(s), {BASE_URL})")
        sys.exit(0)

    msg = ("🔴 PRERENDER CANONICAL POISONING DETECTED\n"
           f"{BASE_URL}\n\n" + "\n".join(all_failures))
    print(msg, file=sys.stderr)

    if args.alert:
        here = os.path.dirname(os.path.abspath(__file__))
        notify = os.path.join(here, "..", "ops", "notify_telegram.py")
        notify = os.path.normpath(notify)
        if os.path.exists(notify):
            try:
                subprocess.run(
                    [sys.executable, notify, "--title",
                     "🔴 SEO canonical poisoning", "-"],
                    input=msg, text=True, check=False,
                )
            except Exception as e:  # noqa
                print(f"(telegram alert failed: {e})", file=sys.stderr)
        else:
            print(f"(notify_telegram.py not found at {notify})", file=sys.stderr)

    sys.exit(1)


if __name__ == "__main__":
    main()
