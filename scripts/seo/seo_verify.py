#!/usr/bin/env python3
# ============================================================================
# seo_verify.py — post-deploy SEO verification gate (stdlib-only)
# ============================================================================
# Distilled from the useful checks in AgriciDaniel/claude-seo, rebuilt around
# this project's #1 constraint: thepicklehub.net serves prerendered HTML *only
# to bots*. A default User-Agent sees the empty React SPA shell, so EVERY check
# here fetches with the Googlebot UA by default. That single decision is what
# makes generic SEO tooling actually correct for this site.
#
# Complements scripts/seo-verify.sh (which does per-route presence checks).
# This adds what the .sh can't:
#   - full-mesh reciprocal hreflang validation (self-ref, return tags,
#     x-default, valid ISO codes) — catches broken VI<->EN linking
#   - deprecated rich-result schema warnings (FAQPage / HowTo / ...)
#   - shell-leak detection (canonical collapsed to "/" = prerender miss)
#   - drift baseline/compare with a tiny sqlite history
#
# Targets the recurring CLAUDE.md production bugs: bot-404, broken hreflang,
# stale schema after SSR changes.
#
# Stdlib only — no pip install, runs anywhere Python 3.8+ exists.
#
# Usage:
#   python3 scripts/seo/seo_verify.py bot-check https://www.thepicklehub.net/blog
#   python3 scripts/seo/seo_verify.py hreflang https://www.thepicklehub.net/blog
#   python3 scripts/seo/seo_verify.py schema   https://www.thepicklehub.net/blog/<slug>
#   python3 scripts/seo/seo_verify.py page     https://www.thepicklehub.net/feed
#   python3 scripts/seo/seo_verify.py drift baseline <url>...   # before a deploy
#   python3 scripts/seo/seo_verify.py drift compare  <url>...   # after a deploy
#
# Flags: --json  --ua googlebot|human|<custom>  --timeout N  --db PATH
#
# Exit code: 0 all pass, 1 any FAIL (CI-friendly). WARN never fails the gate.
# ============================================================================

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from hashlib import sha256
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
HUMAN_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
SITE_ROOT = "https://www.thepicklehub.net/"

# Rich-result types Google has deprecated or never honoured for general sites.
DEPRECATED_SCHEMA = {
    "FAQPage": "FAQ rich results retired for most sites (Aug 2023); keep only if gov/health authority.",
    "HowTo": "HowTo rich results retired (Sep 2023); markup no longer earns enhancement.",
    "SpecialAnnouncement": "COVID-era feature, no longer surfaced.",
    "CriticReview": "Not an active rich result.",
}

_USE_COLOR = sys.stdout.isatty()
def _c(code, s):
    return f"\033[{code}m{s}\033[0m" if _USE_COLOR else s
def green(s): return _c("32", s)
def red(s): return _c("31", s)
def yellow(s): return _c("33", s)
def dim(s): return _c("2", s)


# --------------------------------------------------------------------------- #
# Fetch + parse
# --------------------------------------------------------------------------- #
class _MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_parts: list[str] = []
        self._in_title = False
        self.canonical: str | None = None
        self.robots: str | None = None
        self.alternates: list[tuple[str, str]] = []  # (hreflang, href)
        self.og: dict[str, str] = {}
        self.h1: list[str] = []
        self._in_h1 = False
        self.jsonld: list[str] = []
        self._in_jsonld = False
        self._jsonld_buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self._in_h1 = True
        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            if rel == "canonical" and a.get("href"):
                self.canonical = a["href"].strip()
            elif rel == "alternate" and a.get("hreflang") and a.get("href"):
                self.alternates.append((a["hreflang"].strip(), a["href"].strip()))
        elif tag == "meta":
            name = (a.get("name") or "").lower()
            prop = (a.get("property") or "").lower()
            if name == "robots" and a.get("content"):
                self.robots = a["content"].strip()
            if prop.startswith("og:") and a.get("content"):
                self.og[prop] = a["content"].strip()
        elif tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._in_jsonld = True
            self._jsonld_buf = []

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            blob = "".join(self._jsonld_buf).strip()
            if blob:
                self.jsonld.append(blob)

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)
        if self._in_h1:
            self.h1.append(data.strip())
        if self._in_jsonld:
            self._jsonld_buf.append(data)

    @property
    def title(self) -> str:
        return re.sub(r"\s+", " ", "".join(self.title_parts)).strip()


class Fetched:
    def __init__(self, url, status, final_url, body, error=None):
        self.url = url
        self.status = status
        self.final_url = final_url
        self.body = body or ""
        self.error = error
        self.meta = _MetaParser()
        if self.body:
            try:
                self.meta.feed(self.body)
            except Exception:
                pass

    @property
    def html_hash(self) -> str:
        return sha256(self.body.encode("utf-8", "replace")).hexdigest()[:16]


def fetch(url: str, ua: str, timeout: int) -> Fetched:
    req = Request(url, headers={
        "User-Agent": ua,
        "Accept": "text/html,*/*",
        "Cache-Control": "no-cache",
    })
    try:
        with urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            return Fetched(url, r.status, r.geturl(), body)
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8", "replace")
        except Exception:
            body = ""
        return Fetched(url, e.code, url, body, error=f"HTTP {e.code}")
    except (URLError, TimeoutError) as e:
        return Fetched(url, 0, url, "", error=str(e))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _norm(u: str) -> str:
    """Normalise for comparison: drop trailing slash (except root), lowercase host."""
    if not u:
        return u
    u = u.strip()
    m = re.match(r"^(https?://)([^/]+)(.*)$", u)
    if not m:
        return u.rstrip("/")
    scheme, host, path = m.groups()
    path = path or "/"
    if len(path) > 1:
        path = path.rstrip("/")
    return f"{scheme}{host.lower()}{path}"


def _path_of(u: str) -> str:
    m = re.match(r"^https?://[^/]+(/.*)?$", u.strip())
    p = (m.group(1) if m and m.group(1) else "/")
    return p if p == "/" else p.rstrip("/")


VALID_LANG = re.compile(r"^([a-z]{2})(-[A-Z][a-z]{3})?(-[A-Z]{2})?$")  # en, vi, zh-Hant, en-US


def lang_ok(code: str) -> bool:
    if code == "x-default":
        return True
    return bool(VALID_LANG.match(code))


# --------------------------------------------------------------------------- #
# Checks
# --------------------------------------------------------------------------- #
def check_bot(urls, ua, timeout):
    """bot-404 / shell-leak gate — the check to run after every deploy."""
    results, ok = [], True
    for u in urls:
        f = fetch(u, ua, timeout)
        problems = []
        if f.status != 200:
            problems.append(f"status {f.status or 'ERR'}")
        title = f.meta.title
        if not title:
            problems.append("empty <title>")
        canon = _norm(f.meta.canonical or "")
        if _path_of(u) != "/" and canon == _norm(SITE_ROOT):
            problems.append("canonical collapsed to site root (SPA shell leaked to bot)")
        if not f.meta.alternates:
            problems.append("no hreflang alternates (prerender likely incomplete)")
        passed = not problems
        ok = ok and passed
        results.append({
            "url": u, "pass": passed, "status": f.status,
            "title": title, "canonical": f.meta.canonical,
            "hreflang_count": len(f.meta.alternates),
            "problems": problems, "error": f.error,
        })
    return ok, results


def check_hreflang(urls, ua, timeout):
    """Fetch each url + every alternate it names, validate the full mesh."""
    cache: dict[str, Fetched] = {}
    def get(u):
        k = _norm(u)
        if k not in cache:
            cache[k] = fetch(u, ua, timeout)
        return cache[k]

    queue, seen = list(urls), set()
    sets: dict[str, dict[str, str]] = {}  # norm_url -> {lang: href}
    while queue:
        u = queue.pop(0)
        nu = _norm(u)
        if nu in seen:
            continue
        seen.add(nu)
        f = get(u)
        amap = {}
        for lang, href in f.meta.alternates:
            amap[lang] = href
            if _norm(href) not in seen:
                queue.append(href)
        sets[nu] = amap

    issues, ok = [], True
    def fail(u, msg):
        nonlocal ok
        ok = False
        issues.append({"url": u, "level": "FAIL", "msg": msg})
    def warn(u, msg):
        issues.append({"url": u, "level": "WARN", "msg": msg})

    for nu, amap in sets.items():
        if not amap:
            f = cache.get(nu)
            if f and f.status == 200:
                fail(nu, "no hreflang alternates on a 200 page")
            continue
        for lang in amap:
            if not lang_ok(lang):
                fail(nu, f"invalid hreflang code '{lang}'")
        if "x-default" not in amap:
            warn(nu, "missing x-default")
        if not any(_norm(h) == nu for h in amap.values()):
            fail(nu, "no self-referencing hreflang (page not in its own alternate set)")
        for lang, href in amap.items():
            if lang == "x-default":
                continue
            nh = _norm(href)
            if nh == nu:
                continue
            target = sets.get(nh)
            if target is None:
                warn(nu, f"alternate {lang} -> {href} not fetched/verifiable")
                continue
            if not any(_norm(h) == nu for h in target.values()):
                fail(nu, f"broken return tag: {lang} -> {href} does not link back")
    return ok, {"pages": len(sets), "issues": issues, "sets": sets}


def check_schema(url, ua, timeout):
    f = fetch(url, ua, timeout)
    blocks, ok = [], True
    for i, raw in enumerate(f.meta.jsonld):
        entry = {"index": i, "valid": True, "types": [], "warnings": [], "errors": []}
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            entry["valid"] = False
            entry["errors"].append(f"invalid JSON: {e}")
            ok = False
            blocks.append(entry)
            continue
        if isinstance(data, dict):
            nodes = data.get("@graph") if isinstance(data.get("@graph"), list) else [data]
        elif isinstance(data, list):
            nodes = data
        else:
            nodes = []
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type")
            tlist = t if isinstance(t, list) else [t] if t else []
            for ty in tlist:
                entry["types"].append(ty)
                if ty in DEPRECATED_SCHEMA:
                    entry["warnings"].append(f"{ty}: {DEPRECATED_SCHEMA[ty]}")
        blocks.append(entry)
    return ok, {"url": url, "status": f.status, "block_count": len(blocks),
                "blocks": blocks, "error": f.error}


# --------------------------------------------------------------------------- #
# Drift (sqlite)
# --------------------------------------------------------------------------- #
def _db(path):
    con = sqlite3.connect(path)
    con.execute("""CREATE TABLE IF NOT EXISTS snapshots(
        id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, ts TEXT,
        status INT, title TEXT, canonical TEXT, robots TEXT, h1 TEXT,
        hreflang TEXT, schema_types TEXT, og_count INT, html_hash TEXT)""")
    return con


def _snap(f: Fetched) -> dict:
    types = []
    for raw in f.meta.jsonld:
        try:
            d = json.loads(raw)
        except Exception:
            continue
        nodes = d.get("@graph", [d]) if isinstance(d, dict) else (d if isinstance(d, list) else [])
        for n in nodes:
            if isinstance(n, dict) and n.get("@type"):
                t = n["@type"]
                types += t if isinstance(t, list) else [t]
    return {
        "status": f.status, "title": f.meta.title, "canonical": f.meta.canonical,
        "robots": f.meta.robots, "h1": " | ".join(x for x in f.meta.h1 if x),
        "hreflang": json.dumps({l: h for l, h in f.meta.alternates}, sort_keys=True),
        "schema_types": json.dumps(sorted(types)), "og_count": len(f.meta.og),
        "html_hash": f.html_hash,
    }


def drift_baseline(urls, ua, timeout, path):
    con = _db(path)
    out = []
    for u in urls:
        f = fetch(u, ua, timeout)
        s = _snap(f)
        con.execute(
            """INSERT INTO snapshots(url,ts,status,title,canonical,robots,h1,hreflang,schema_types,og_count,html_hash)
               VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            (u, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), s["status"], s["title"],
             s["canonical"], s["robots"], s["h1"], s["hreflang"], s["schema_types"],
             s["og_count"], s["html_hash"]))
        out.append({"url": u, "status": s["status"], "title": s["title"], "html_hash": s["html_hash"]})
    con.commit()
    con.close()
    return True, {"saved": out, "db": path}


def drift_compare(urls, ua, timeout, path):
    if not os.path.exists(path):
        return False, {"error": f"no baseline db at {path}; run 'drift baseline' first"}
    con = _db(path)
    ok, out = True, []
    fields = ["status", "title", "canonical", "robots", "h1", "hreflang", "schema_types", "og_count", "html_hash"]
    for u in urls:
        row = con.execute(
            "SELECT %s FROM snapshots WHERE url=? ORDER BY id DESC LIMIT 1" % ",".join(fields),
            (u,)).fetchone()
        if not row:
            out.append({"url": u, "baseline": False})
            continue
        base = dict(zip(fields, row))
        cur = _snap(fetch(u, ua, timeout))
        changes = []
        for k in fields:
            if k == "html_hash":
                continue
            if str(base[k]) != str(cur[k]):
                changes.append({"field": k, "from": base[k], "to": cur[k]})
        regressions = [c for c in changes if c["field"] in ("status", "canonical", "hreflang")
                       or (c["field"] == "title" and not cur["title"])]
        if regressions:
            ok = False
        out.append({"url": u, "changes": changes, "regressions": regressions,
                    "html_changed": base["html_hash"] != cur["html_hash"]})
    con.close()
    return ok, {"compared": out}


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #
def render(cmd, ok, data, as_json):
    if as_json:
        print(json.dumps({"command": cmd, "pass": ok, "data": data}, indent=2, ensure_ascii=False))
        return
    tag = green("PASS") if ok else red("FAIL")
    if cmd == "bot-check":
        for r in data:
            mark = green("OK  ") if r["pass"] else red("FAIL")
            print(f"{mark} {r['url']}")
            print(dim(f"     {r['status']} · {(r['title'] or '(no title)')[:70]} · hreflang×{r['hreflang_count']}"))
            for p in r["problems"]:
                print(red(f"     ✗ {p}"))
        print(f"\n{tag} bot-check")
    elif cmd == "page":
        r = data
        print(f"{r['url']}\n  status     {r['status']}\n  title      {r['title']}")
        print(f"  canonical  {r['canonical']}\n  h1         {r['h1']}")
        print(f"  hreflang   {r['hreflang']}")
        print(f"  og tags    {r['og_count']}   schema blocks {r['schema_blocks']}   words {r['words']}")
    elif cmd == "hreflang":
        print(f"Validated {data['pages']} page(s) in the mesh.")
        for i in data["issues"]:
            col = red if i["level"] == "FAIL" else yellow
            print(col(f"  {i['level']} {i['url']}\n        {i['msg']}"))
        if not data["issues"]:
            print(green("  no issues — full mesh intact"))
        print(f"\n{tag} hreflang")
    elif cmd == "schema":
        print(f"{data['url']}  ({data['block_count']} JSON-LD block(s), status {data['status']})")
        for b in data["blocks"]:
            t = ", ".join(b["types"]) or "(no @type)"
            print(f"  block {b['index']}: {t}" + ("" if b["valid"] else red("  INVALID JSON")))
            for e in b["errors"]:
                print(red(f"     ✗ {e}"))
            for w in b["warnings"]:
                print(yellow(f"     ⚠ {w}"))
        print(f"\n{tag} schema")
    elif cmd == "drift-baseline":
        for s in data["saved"]:
            print(green(f"  saved {s['url']}  [{s['status']}] {s['html_hash']}  {(s['title'] or '')[:50]}"))
        print(dim(f"  db: {data['db']}"))
    elif cmd == "drift-compare":
        if "error" in data:
            print(red(f"  {data['error']}"))
        else:
            for c in data["compared"]:
                if not c.get("baseline", True):
                    print(yellow(f"  {c['url']}  no baseline"))
                    continue
                if not c["changes"]:
                    print(green(f"  {c['url']}  unchanged"))
                    continue
                print(f"  {c['url']}  {dim('(html changed)' if c['html_changed'] else '')}")
                for ch in c["changes"]:
                    col = red if ch in c["regressions"] else yellow
                    fr, to = str(ch["from"])[:50], str(ch["to"])[:50]
                    print(col(f"     {ch['field']}: {fr}  ->  {to}"))
        print(f"\n{tag} drift")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv=None):
    p = argparse.ArgumentParser(description="ThePickleHub SEO verification gate (Googlebot-UA by default).")
    p.add_argument("command", choices=["bot-check", "page", "hreflang", "schema", "drift"])
    p.add_argument("args", nargs="*", help="urls, or for drift: baseline|compare <url>...")
    p.add_argument("--json", action="store_true")
    p.add_argument("--ua", default="googlebot", help="googlebot (default) | human | <custom UA string>")
    p.add_argument("--timeout", type=int, default=20)
    p.add_argument("--db", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seo_drift.db"))
    # parse_intermixed_args so flags work either before or after the url list
    # (e.g. both `bot-check --ua human <url>` and `bot-check <url> --ua human`).
    a = p.parse_intermixed_args(argv)

    ua = {"googlebot": GOOGLEBOT_UA, "human": HUMAN_UA}.get(a.ua.lower(), a.ua)
    ok = True

    if a.command == "bot-check":
        if not a.args:
            p.error("bot-check needs at least one url")
        ok, data = check_bot(a.args, ua, a.timeout)
        render("bot-check", ok, data, a.json)
    elif a.command == "page":
        if not a.args:
            p.error("page needs a url")
        f = fetch(a.args[0], ua, a.timeout)
        data = {
            "url": a.args[0], "status": f.status, "title": f.meta.title,
            "canonical": f.meta.canonical, "h1": " | ".join(x for x in f.meta.h1 if x),
            "hreflang": ", ".join(f"{l}->{h}" for l, h in f.meta.alternates) or "(none)",
            "og_count": len(f.meta.og), "schema_blocks": len(f.meta.jsonld),
            "words": len(re.findall(r"\w+", re.sub(r"<[^>]+>", " ", f.body))),
        }
        ok = f.status == 200 and bool(f.meta.title)
        render("page", ok, data, a.json)
    elif a.command == "hreflang":
        if not a.args:
            p.error("hreflang needs at least one url")
        ok, data = check_hreflang(a.args, ua, a.timeout)
        render("hreflang", ok, data, a.json)
    elif a.command == "schema":
        if not a.args:
            p.error("schema needs a url")
        ok, data = check_schema(a.args[0], ua, a.timeout)
        render("schema", ok, data, a.json)
    elif a.command == "drift":
        if len(a.args) < 2 or a.args[0] not in ("baseline", "compare"):
            p.error("usage: drift baseline|compare <url>...")
        sub, urls = a.args[0], a.args[1:]
        if sub == "baseline":
            ok, data = drift_baseline(urls, ua, a.timeout, a.db)
            render("drift-baseline", ok, data, a.json)
        else:
            ok, data = drift_compare(urls, ua, a.timeout, a.db)
            render("drift-compare", ok, data, a.json)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
