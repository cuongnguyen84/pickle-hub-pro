#!/usr/bin/env python3
"""Hai bộ đo SEO mà đội chưa có: crawl mẫu theo sitemap, và trích dẫn AI search.

Cả hai chỉ ĐỌC. Không bộ đo nào kết luận một con số nó chưa đo được: nguồn
không đọc được thì ném lỗi để supervisor ghi "chưa đo được", đúng luật của
role growth ("không coi thiếu dữ liệu là số 0").

Vì sao cần:
  - `scripts/seo-verify.sh` và `scripts/seo/canonical_monitor.py` đều chạy trên
    DANH SÁCH ROUTE CỐ ĐỊNH. Sitemap đang có ~3000 URL (venues 1948, news 799);
    chưa có gì soát phần còn lại. Bộ đo này lấy mẫu xoay vòng theo ngày nên sau
    vài tuần mọi URL đều được chạm tới mà mỗi ngày chỉ tốn ~40 request.
  - Không có gì đo được site có được ChatGPT/Perplexity trích dẫn hay không,
    dù CLAUDE.md đã tối ưu passage cho GEO từ 14/08. Ahrefs Brand Radar chặn
    theo gói nên phải tự hỏi một AI search có dẫn nguồn rồi đếm.

Chạy tay:
    python3 scripts/ops/team_seo.py crawl
    python3 scripts/ops/team_seo.py citation      # tốn tiền OpenAI, xem GIỚI HẠN
"""
from __future__ import annotations

import json
import os
import re
import socket
import time
import urllib.error
import urllib.request
from pathlib import Path

# Cùng nguyên nhân với team_supervisor.py: tuyến IPv6 của máy này treo tay bắt
# TLS. Ưu tiên IPv4, vẫn giữ IPv6 làm dự phòng và giữ nguyên xác thực TLS.
_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **kw: sorted(_getaddrinfo(*a, **kw), key=lambda entry: entry[0] != socket.AF_INET)
if Path("/etc/ssl/cert.pem").exists():
    os.environ.setdefault("SSL_CERT_FILE", "/etc/ssl/cert.pem")

SITE = os.environ.get("SEO_BASE_URL", "https://www.thepicklehub.net").rstrip("/")
GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
PER_SEGMENT = int(os.environ.get("SEO_CRAWL_PER_SEGMENT", "3"))
# Sàn số từ theo loại trang, không phải một con số chung. Trang bài viết mỏng
# là lỗi (05/08: hong-kong-slam-2026-preview ra 71 từ thay vì 1518); trang hồ
# sơ người chơi hay CLB vốn chỉ có vài chục từ — bắt lỗi chúng mỗi ngày chỉ tạo
# một việc không ai đóng được. Dưới sàn mặc định nghĩa là bot nhận vỏ trang.
# news = bài viết lại ngắn: mẫu 10 bài cho 244–738 từ, nên sàn 180 bắt được bản
# render rỗng mà không réo vì một bài vốn ngắn. blog thì 71 từ chính là lỗi 05/08.
WORD_FLOORS = {"blog": 250, "news": 180, "static": 120, "venues": 100, "shop": 100}
DEFAULT_WORD_FLOOR = int(os.environ.get("SEO_WORD_FLOOR", "60"))
MAX_BYTES = 3_000_000  # sitemap-venues.xml ~1.9k URL; đọc có trần để khỏi nuốt cả bộ nhớ.

LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
URL_BLOCK_RE = re.compile(r"(?is)<url>(.*?)</url>")
XHTML_RE = re.compile(r'(?i)<xhtml:link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"')
CANON_RE = re.compile(r'(?i)<link[^>]+rel="canonical"[^>]*href="([^"]+)"')
ALT_TAG_RE = re.compile(r'(?i)<link[^>]+rel="alternate"[^>]*>')
TITLE_RE = re.compile(r"(?is)<title[^>]*>(.*?)</title>")


def fetch(url, timeout=25, attempts=2):
    """Trả (status, text). HTTPError là dữ liệu (4xx/5xx của site); lỗi mạng ném lên.

    Thử lại một lần: tay bắt TLS trên máy này thỉnh thoảng treo, và một bộ đo
    chết vì một lần chập mạng thì ngày nào cũng báo động giả.
    """
    request = urllib.request.Request(url, headers={
        "User-Agent": GOOGLEBOT, "Accept": "text/html,application/xml", "Accept-Language": "vi,en"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read(MAX_BYTES).decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            return exc.code, ""
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt + 1 == attempts:
                raise
            time.sleep(2)


def segments(index_xml):
    return [u for u in LOC_RE.findall(index_xml) if "/sitemap-" in u]


def sitemap_entries(xml):
    """[{'loc':..., 'alts': {lang: href}}] — hreflang khai trong CHÍNH sitemap."""
    entries = []
    for block in URL_BLOCK_RE.findall(xml):
        loc = LOC_RE.search(block)
        if loc:
            entries.append({"loc": loc.group(1), "alts": {l.lower(): h for l, h in XHTML_RE.findall(block)}})
    return entries


def page_facts(html):
    canonical = CANON_RE.search(html)
    title = TITLE_RE.search(html)
    alts = {}
    for tag in ALT_TAG_RE.findall(html):
        lang = re.search(r'hreflang="([^"]+)"', tag, re.I)
        href = re.search(r'href="([^"]+)"', tag, re.I)
        if lang and href:
            alts[lang.group(1).lower()] = href.group(1)
    body = re.sub(r"(?is)<(script|style|template|noscript)[^>]*>.*?</\1>", " ", html)
    body = re.sub(r"(?s)<[^>]+>", " ", body)
    return {"canonical": canonical.group(1) if canonical else None,
            "title": " ".join(title.group(1).split()) if title else "",
            "alts": alts, "words": len(re.sub(r"\s+", " ", body).split())}


def sample(entries, per, day):
    """Xoay vòng theo ngày: sau ceil(n/per) ngày mọi URL đều được chạm tới."""
    if not entries:
        return []
    start = (day * per) % len(entries)
    return [entries[(start + i) % len(entries)] for i in range(min(per, len(entries)))]


def audit_page(entry, status, facts, known_locs, floor=DEFAULT_WORD_FLOOR):
    """Trả danh sách (kind, detail). Không có phát hiện = trang đạt."""
    loc, found = entry["loc"], []
    if status != 200:
        return [("status", f"{loc} trả HTTP {status} cho Googlebot")]
    canonical = facts["canonical"]
    if not canonical:
        found.append(("canonical_missing", f"{loc} không có thẻ canonical"))
    elif canonical.rstrip("/") != loc.rstrip("/"):
        # Sitemap chỉ được liệt kê URL canonical. Khác nhau = hoặc sitemap liệt
        # kê URL sai, hoặc prerender trả canonical của trang khác (poisoning).
        found.append(("canonical_mismatch", f"{loc} khai canonical là {canonical}"))
    if not facts["title"]:
        found.append(("title_missing", f"{loc} không có <title>"))
    if facts["words"] < floor:
        found.append(("thin_body", f"{loc} chỉ có {facts['words']} từ trong HTML bot nhận được (sàn {floor})"))
    page_langs, map_langs = set(facts["alts"]), set(entry["alts"])
    if page_langs != map_langs:
        found.append(("hreflang_mismatch",
                      f"{loc}: trang khai {sorted(page_langs) or 'không có'}, sitemap khai {sorted(map_langs) or 'không có'}"))
    for lang, href in facts["alts"].items():
        if lang != "x-default" and href.rstrip("/") not in known_locs:
            found.append(("hreflang_orphan", f"{loc} trỏ hreflang {lang} tới {href} — URL này không có trong sitemap"))
    return found


def crawl_observation(get=fetch, day=None, per_segment=PER_SEGMENT, recheck=None):
    """`recheck`: file giữ các URL từng lỗi, để đo lại CHÍNH chúng ở lượt sau.

    Không có nó thì mẫu xoay vòng mỗi ngày một URL khác, phát hiện hôm qua tự
    "hết" vì hôm nay bốc trúng trang lành — việc đóng rồi mở lại mỗi ngày và
    Telegram réo vô ích. Có nó thì việc chỉ đóng khi đúng URL cũ đã đạt.
    """
    day = int(time.time() // 86400) if day is None else day
    path = Path(recheck) if recheck else None
    previous = []
    if path and path.exists():
        try:
            previous = json.loads(path.read_text())[:50]
        except (ValueError, OSError):
            previous = []
    status, index_xml = get(f"{SITE}/sitemap.xml")
    if status != 200 or not index_xml:
        raise RuntimeError("sitemap_index_unreadable")
    maps = segments(index_xml)
    if not maps:
        raise RuntimeError("sitemap_index_empty")
    corpus, picked, results, problems = set(), [], [], {}
    segment_rows, catalogue = [], {}
    for url in maps:
        name = url.rsplit("/sitemap-", 1)[-1].removesuffix(".xml")
        status, xml = get(url)
        if status != 200 or not xml:
            problems[f"segment:{name}"] = f"sitemap-{name}.xml không đọc được (HTTP {status})"
            segment_rows.append({"segment": name, "readable": False})
            continue
        entries = sitemap_entries(xml)
        corpus.update(e["loc"].rstrip("/") for e in entries)
        catalogue.update({e["loc"]: (name, e) for e in entries})
        chosen = sample(entries, per_segment, day)
        picked += [(name, e) for e in chosen]
        segment_rows.append({"segment": name, "total": len(entries), "sampled": len(chosen),
                             "with_hreflang": sum(bool(e["alts"]) for e in entries)})
    if not picked:
        raise RuntimeError("no_sampled_urls")
    # URL từng lỗi mà vẫn còn trong sitemap được đo lại; rời sitemap = hết việc.
    chosen_locs = {e["loc"] for _, e in picked}
    picked += [catalogue[loc] for loc in previous if loc in catalogue and loc not in chosen_locs]
    seen_titles, seen_canonicals = {}, {}
    failing = []
    for name, entry in picked:
        status, html = get(entry["loc"])
        facts = page_facts(html) if html else {"canonical": None, "title": "", "alts": {}, "words": 0}
        findings = audit_page(entry, status, facts, corpus, WORD_FLOORS.get(name, DEFAULT_WORD_FLOOR))
        for kind, detail in findings:
            problems.setdefault(f"{name}:{kind}", detail)
        if status == 200 and facts["title"]:
            seen_titles.setdefault(facts["title"], []).append(entry["loc"])
            if facts["canonical"]:
                seen_canonicals.setdefault(facts["canonical"], []).append(entry["loc"])
        if findings:
            failing.append(entry["loc"])
        results.append({"segment": name, "url": entry["loc"], "status": status,
                        "words": facts["words"], "title": facts["title"][:120],
                        "issues": [k for k, _ in findings]})
    # Chữ ký của sự cố canonical-poisoning: nhiều path khác nhau, một canonical.
    for canonical, urls in seen_canonicals.items():
        if len(urls) > 1:
            problems["poisoning:canonical"] = f"{len(urls)} URL khác nhau cùng trả canonical {canonical}"
    for title, urls in seen_titles.items():
        if len(urls) > 2:
            problems["poisoning:title"] = f"{len(urls)} URL khác nhau cùng một <title>: {title[:60]}"
    if path:
        try:
            path.write_text(json.dumps(failing[:50], ensure_ascii=False))
        except OSError:
            pass
    return {"problems": problems, "segments": segment_rows, "sampled": results,
            "rechecked": [loc for loc in previous if loc in catalogue],
            "corpus_size": len(corpus), "day_index": day,
            "word_floors": {**WORD_FLOORS, "*": DEFAULT_WORD_FLOOR},
            "note": "Mẫu xoay vòng theo ngày; trang không nằm trong mẫu hôm nay chưa được kiểm tra, không kết luận là đạt."}


# ─── Trích dẫn AI search ───────────────────────────────────────────────────
# Đo bằng một AI search CÓ DẪN NGUỒN: hỏi đúng câu người Việt hay hỏi, rồi đếm
# xem nguồn nó dẫn có thepicklehub.net không. Đây là đo ĐẦU RA của AI search,
# không phải đo thứ hạng Google.
PROMPTS = [
    "Giải pickleball nào sắp diễn ra ở Việt Nam? Nêu tên, ngày và nơi tổ chức.",
    "Sân pickleball ở TP.HCM giá bao nhiêu một giờ và đặt ở đâu?",
    "Bảng xếp hạng pickleball Việt Nam hiện nay ai đứng đầu?",
    "Luật tính điểm pickleball đánh đôi giải thích ngắn gọn.",
    "Xem trực tiếp giải pickleball ở Việt Nam ở đâu?",
    "Các câu lạc bộ pickleball ở Hà Nội và cách tham gia.",
]
OWN_DOMAIN = "thepicklehub.net"
CITATION_MODEL = os.environ.get("SEO_CITATION_MODEL", "gpt-5.6")
WEEK_SECONDS = 7 * 86400


def ask_openai(api_key, prompt, timeout=180):
    body = json.dumps({
        "model": CITATION_MODEL,
        "tools": [{"type": "web_search"}],
        "reasoning": {"effort": "low"},
        "input": prompt,
    }).encode()
    request = urllib.request.Request("https://api.openai.com/v1/responses", data=body, headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def citations(payload):
    """URL mà câu trả lời thực sự dẫn nguồn (annotation), không phải mọi URL đã đọc."""
    urls = []
    for item in payload.get("output") or []:
        for content in item.get("content") or []:
            for annotation in content.get("annotations") or []:
                if annotation.get("type") == "url_citation" and annotation.get("url"):
                    urls.append(annotation["url"])
    return urls


def domain(url):
    return re.sub(r"^www\.", "", (re.sub(r"^https?://", "", url).split("/")[0] or "")).lower()


def citation_observation(api_key, ask=ask_openai, prompts=PROMPTS, cache=None, now=None):
    now = time.time() if now is None else now
    if not api_key:
        raise RuntimeError("missing_openai_credential")
    path = Path(cache) if cache else None
    if path and path.exists():
        try:
            previous = json.loads(path.read_text())
            if now - previous.get("measured_at", 0) < WEEK_SECONDS:
                return {**previous, "from_cache": True}
        except (ValueError, OSError):
            pass
    asked, cited, rivals = [], 0, {}
    for prompt in prompts:
        urls = citations(ask(api_key, prompt))
        domains = [domain(u) for u in urls]
        hit = any(d.endswith(OWN_DOMAIN) for d in domains)
        cited += hit
        for d in domains:
            if d and not d.endswith(OWN_DOMAIN):
                rivals[d] = rivals.get(d, 0) + 1
        asked.append({"prompt": prompt, "cited": hit, "sources": sorted(set(domains))})
    top = sorted(rivals.items(), key=lambda kv: -kv[1])[:10]
    problems = {}
    if cited == 0:
        problems["ai_citation"] = (f"AI search không dẫn {OWN_DOMAIN} ở cả {len(prompts)} câu hỏi tiếng Việt; "
                                   f"đang dẫn: {', '.join(d for d, _ in top[:5]) or 'không rõ'}")
    elif cited < len(prompts) / 2:
        problems["ai_citation"] = f"AI search chỉ dẫn {OWN_DOMAIN} ở {cited}/{len(prompts)} câu hỏi"
    result = {"problems": problems, "measured_at": now, "engine": f"openai:{CITATION_MODEL}",
              "cited": cited, "asked": len(prompts), "answers": asked,
              "competitors": [{"domain": d, "citations": n} for d, n in top],
              "note": "Một lượt đo của một engine tại một thời điểm; AI search không tất định, đừng đọc như thứ hạng."}
    if path:
        try:
            path.write_text(json.dumps(result, ensure_ascii=False))
        except OSError:
            pass
    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["crawl", "citation"])
    parser.add_argument("--cache", help="đường dẫn cache tuần cho citation")
    args = parser.parse_args()
    if args.action == "crawl":
        print(json.dumps(crawl_observation(), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(citation_observation(os.environ.get("OPENAI_API_KEY"), cache=args.cache),
                         ensure_ascii=False, indent=2))


# ─── Watchtower: tụt traffic ───────────────────────────────────────────────
# Đọc báo cáo của scripts/seo/gsc_report.py (đã tự tính WoW và trang mất click).
# Cái khó KHÔNG phải phát hiện tụt — mà phân biệt "hết sự kiện" với "site hỏng".
# Ngày 21/09: clicks -92,2% (3803 -> 297) mà 94% cú tụt nằm ở 5 trang World Cup
# Đà Nẵng, cả 5 vẫn trả 200 với đủ nội dung. Một ngưỡng % trần trụi sẽ báo động
# đỏ vào đúng cái ngày không có gì hỏng, và alert nào cũng vậy: réo sai vài lần
# là người ta thôi đọc. Nên phép thử quyết định là SỨC KHOẺ CỦA CHÍNH TRANG ĐÓ.
MIN_PREV_CLICKS = 50      # nền nhỏ hơn thì mọi phần trăm đều là nhiễu
DECLINE_PCT = -30.0       # ngưỡng tụt toàn site
CONCENTRATION = 0.6       # >= mức này coi là mất theo vài trang, không phải toàn site
LOSER_MIN_DELTA = -20     # trang mất ít hơn thế thì không đáng soi


def segment_of(url):
    path = re.sub(r"^https?://[^/]+", "", url)
    for name in ("blog", "news", "shop"):
        if path.startswith(f"/{name}/") or path.startswith(f"/vi/{name}/"):
            return name
    if path.startswith("/san/") or path.startswith("/vi/san/"):
        return "venues"
    return "static" if path.count("/") <= 2 else "*"


def page_health(url, get=fetch):
    """None = trang vẫn phục vụ được. Chuỗi = lý do nó không còn phục vụ được."""
    floor = WORD_FLOORS.get(segment_of(url), DEFAULT_WORD_FLOOR)
    status, html = get(url)
    if status != 200:
        return f"HTTP {status}"
    facts = page_facts(html)
    if not facts["canonical"]:
        return "mất thẻ canonical"
    if facts["words"] < floor:
        return f"chỉ còn {facts['words']} từ (sàn {floor})"
    return None


def decline_observation(gsc, get=fetch, max_checked=8):
    """Trả (problems, detail) từ báo cáo gsc_report.py. Không có báo cáo = không kết luận."""
    if not isinstance(gsc, dict) or not gsc.get("totals"):
        return {}, {"measured": False, "reason": "chưa có báo cáo GSC"}
    previous = gsc["totals"].get("previous", {})
    current = gsc["totals"].get("current", {})
    clicks_pct = (gsc.get("wow_pct") or {}).get("clicks")
    base = previous.get("clicks", 0)
    detail = {"measured": True, "window": gsc.get("window"), "clicks_pct": clicks_pct,
              "clicks": [base, current.get("clicks", 0)],
              "position_delta": (gsc.get("wow_pct") or {}).get("position_delta")}
    if base < MIN_PREV_CLICKS:
        return {}, {**detail, "verdict": f"nền tuần trước chỉ {base} click, dưới {MIN_PREV_CLICKS} nên không kết luận xu hướng"}

    losers = [l for l in gsc.get("pages_losing_clicks", []) if l.get("delta", 0) <= LOSER_MIN_DELTA]
    lost_total = -sum(l["delta"] for l in losers) or 1
    concentration = round(-sum(l["delta"] for l in losers[:5]) / lost_total, 2)
    broken = []
    for loser in losers[:max_checked]:
        try:
            reason = page_health(loser["page"], get)
        except Exception:
            reason = None  # không đọc được trang thì không kết tội nó; lượt sau đo lại
        if reason:
            broken.append({**loser, "reason": reason})
    detail.update(losers_checked=len(losers[:max_checked]), concentration=concentration,
                  broken=broken, top_losers=losers[:5])

    problems = {}
    if broken:
        problems["decline_broken"] = ("Trang mất click VÀ không còn phục vụ được: " +
                                      "; ".join(f"{b['page']} ({b['clicks_prev']}→{b['clicks_now']} click, {b['reason']})" for b in broken[:3]))
        detail["verdict"] = "Tụt kèm trang hỏng — đây là lỗi của mình, không phải cầu giảm."
    elif clicks_pct is not None and clicks_pct <= DECLINE_PCT and concentration < CONCENTRATION:
        problems["decline_sitewide"] = (f"Click giảm {clicks_pct}% ({base}→{current.get('clicks', 0)}) và trải đều toàn site "
                                        f"(5 trang mất nhiều nhất chỉ chiếm {int(concentration * 100)}% cú tụt); cần tìm nguyên nhân chung")
        detail["verdict"] = "Tụt trải đều, các trang vẫn khoẻ — nghi thuật toán hoặc vấn đề toàn site."
    elif clicks_pct is not None and clicks_pct <= DECLINE_PCT:
        detail["verdict"] = (f"Click giảm {clicks_pct}% nhưng {int(concentration * 100)}% cú tụt dồn vào 5 trang vẫn trả 200 "
                             "với đủ nội dung — cầu theo sự kiện hết, không mở việc.")
    else:
        detail["verdict"] = "Không có dấu hiệu tụt cần xử lý."
    return problems, detail
