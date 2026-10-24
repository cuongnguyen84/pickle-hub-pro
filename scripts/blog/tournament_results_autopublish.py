#!/usr/bin/env python3
"""Publish a verified tournament score snapshot as an EN + VI post.

This is deliberately deterministic: it only accepts the event's official PPA
scores feed, validates the event id and final-match winners, and regenerates the
same four blog surfaces used by the normal blog pipeline.  It never guesses a
score.  The caller may run it repeatedly; an unchanged feed is a no-op.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import string
import subprocess
import sys
import urllib.request
import urllib.parse
import ssl
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "ops"))
import team_wriai as w  # noqa: E402

ALLOWED = {"scheduled", "live", "final", "completed", "finished", "walkover", "retired"}
DIV_VI = {"Men's Singles": "Đơn nam", "Women's Singles": "Đơn nữ",
          "Men's Doubles": "Đôi nam", "Women's Doubles": "Đôi nữ",
          "Mixed Doubles": "Đôi nam nữ"}


def fetch(url: str, event_id: str) -> tuple[dict, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "ThePickleHub-results/1.0"})
    context = ssl.create_default_context(cafile="/etc/ssl/cert.pem") if Path("/etc/ssl/cert.pem").exists() else None
    with urllib.request.urlopen(req, timeout=20, context=context) as response:
        data = json.loads(response.read(2_000_000))
    validate_feed(data, event_id)
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return data, hashlib.sha256(raw.encode()).hexdigest()


def validate_feed(feed: dict, event_id: str) -> None:
    if not isinstance(feed, dict) or str(feed.get("tournamentId")) != event_id:
        raise ValueError("score_event_id_mismatch")
    matches = feed.get("matches")
    if not isinstance(matches, list) or not matches:
        raise ValueError("score_matches_missing")
    for match in matches:
        if not isinstance(match, dict) or match.get("status") not in ALLOWED:
            raise ValueError("score_status_unknown")
        teams = match.get("teams")
        if not isinstance(teams, list) or len(teams) != 2:
            raise ValueError("score_teams_invalid")
        if match["status"] in {"final", "completed", "finished", "walkover", "retired"}:
            winners = [t for t in teams if t.get("winner") is True]
            if len(winners) != 1:
                raise ValueError("final_winner_ambiguous")


def _names(team):
    return " / ".join(str(x) for x in team.get("players") or []) or "TBA"


def _match_line(match, vi=False):
    a, b = match["teams"]
    # Regional feeds decorate the label: "Pro Men's Singles" (Asia), "PRO MEN'S SINGLES - MAIN DRAW" (Australia).
    division = re.sub(r"(?i)^pro\s+|\s+-\s+main draw$", "", str(match.get("division") or ""))
    division = string.capwords(division) if division.isupper() else division
    division = DIV_VI.get(division, division or "Nội dung") if vi else division or "Division"
    label = match.get("roundLabel") or "Vòng chưa ghi nhãn"
    status = match["status"]
    if status in {"final", "completed", "finished", "walkover", "retired"}:
        winner = a if a.get("winner") else b
        loser = b if winner is a else a
        scores = ", ".join(f"{x}-{y}" for x, y in zip(winner.get("games") or [], loser.get("games") or []) if x is not None and y is not None and (x or y))  # unplayed game 3 comes back as 0-0
        if vi:
            return f"{division}, {label}: {_names(winner)} thắng {_names(loser)}" + (f" ({scores})" if scores else f" ({status})") + "."
        return f"{division}, {label}: {_names(winner)} beat {_names(loser)}" + (f" ({scores})" if scores else f" ({status})") + "."
    if vi:
        return f"{division}, {label}: {_names(a)} gặp {_names(b)} — trạng thái {status}."
    return f"{division}, {label}: {_names(a)} vs {_names(b)} — status {status}."


ROUND_VI = {"Final": "Chung kết", "Finals": "Chung kết",
            "Semi Finals": "Bán kết", "Semi Final": "Bán kết", "Semifinals": "Bán kết", "Semifinal": "Bán kết",
            "Quarter Finals": "Tứ kết", "Quarter Final": "Tứ kết", "Quarterfinals": "Tứ kết", "Quarterfinal": "Tứ kết",
            "Round 16": "Vòng 16", "Round 32": "Vòng 32", "Round 64": "Vòng 64", "Round 128": "Vòng 128",
            "Round Robin": "Vòng bảng"}


def _division(match, vi: bool = False) -> str:
    """Division label exactly as the prose line renders it (draw grouping key)."""
    return _match_line(match, vi).split(",", 1)[0]


def _round_label(match, vi: bool = False) -> str:
    label = str(match.get("roundLabel") or "Vòng chưa ghi nhãn")
    return ROUND_VI.get(label, label) if vi else label


def _anchor(division: str) -> str:
    """In-page anchor id for a draw section — the same slug rule the TS
    renderers apply to the board's division name (strip diacritics,
    lowercase, non-alphanumerics collapse to single dashes)."""
    import unicodedata
    # đ/Đ has no NFKD decomposition — map it first or "Đôi nữ" loses the d;
    # apostrophes drop out entirely ("Women's" → "womens", not "women-s").
    slug = unicodedata.normalize("NFKD", division.replace("Đ", "D").replace("đ", "d").replace("'", "").replace("’", "")).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return f"rb-{slug}"


def _round_collapsed(match) -> bool:
    """Early rounds start collapsed: Round of 32 and below, plus qualifiers.
    Judged on the raw feed label so EN and VI boards agree."""
    label = str(match.get("roundLabel") or "")
    m = re.search(r"(?i)round\s+(?:of\s+)?(\d+)", label)
    return bool((m and int(m.group(1)) >= 32) or re.search(r"(?i)qualif", label))


def _match_struct(match) -> dict:
    """The board form of a completed match — same facts as _match_line,
    kept structured (winner/loser/set scores) for the results board."""
    a, b = match["teams"]
    winner = a if a.get("winner") else b
    loser = b if winner is a else a
    sets = [[x, y] for x, y in zip(winner.get("games") or [], loser.get("games") or [])
            if x is not None and y is not None and (x or y)]  # unplayed game 3 comes back as 0-0
    out = {"winner": _names(winner), "loser": _names(loser), "sets": sets}
    if match["status"] in {"walkover", "retired"}:
        out["status"] = match["status"]
    return out


def _board(rows: list, division: str, vi: bool = False) -> dict:
    """Group a draw's completed matches (already sorted latest round first)
    into rounds for the structured board. Champion mirrors draw_sections."""
    top = rows[0]
    champion = None
    if re.fullmatch(r"(?i)finals?", str(top.get("roundLabel") or "").strip()):
        champion = _names(top["teams"][0] if top["teams"][0].get("winner") else top["teams"][1])
    rounds: list = []
    for m in rows:
        label = _round_label(m, vi)
        if not rounds or rounds[-1]["label"] != label:
            entry = {"label": label, "matches": []}
            if _round_collapsed(m):
                entry["collapsed"] = True
            rounds.append(entry)
        rounds[-1]["matches"].append(_match_struct(m))
    board = {"division": division, "rounds": rounds}
    if champion:
        board["champion"] = champion
    return board


def _match_fixture(match) -> dict:
    """The board form of a match that has not been played — two teams, no
    winner, no sets. Renderers branch on teamA/teamB so a fixture can never
    be presented as a result."""
    a, b = match["teams"]
    return {"teamA": _names(a), "teamB": _names(b), "sets": []}


def _board_fixtures(rows: list, division: str, vi: bool = False) -> dict:
    """Group a draw's unplayed matches into rounds for the structured
    board, earliest round first (a schedule reads in play order, unlike
    results which lead with the latest round)."""
    rows = sorted(rows, key=lambda m: (int(m.get("roundNumber", 0) or 0), str(m.get("dateKey", ""))))
    rounds: list = []
    for m in rows:
        label = _round_label(m, vi)
        if not rounds or rounds[-1]["label"] != label:
            entry = {"label": label, "matches": []}
            if _round_collapsed(m):
                entry["collapsed"] = True
            rounds.append(entry)
        rounds[-1]["matches"].append(_match_fixture(m))
    return {"division": division, "rounds": rounds}


def draw_sections_scheduled(pending: list, vi: bool = False) -> list:
    """One section per division with EVERY unplayed match as a fixture
    board — the pre-event form of draw_sections. Without this, an event
    with no finals yet rendered as a 10-line prose list (the old format
    flagged on the World Championships page, 2026-10-24)."""
    by_div: dict[str, list] = {}
    for m in pending:
        by_div.setdefault(_division(m, vi), []).append(m)
    out = []
    for division, rows in by_div.items():
        rows.sort(key=lambda m: (int(m.get("roundNumber", 0) or 0), str(m.get("dateKey", ""))))
        board = _board_fixtures(rows, division, vi)
        if vi:
            lead = f"{len(rows)} trận đã lên lịch, vòng sớm nhất ở trên."
            out.append({"heading": f"Lịch thi đấu {division}", "content": lead, "resultsBoard": board})
        else:
            lead = f"{len(rows)} matches scheduled, earliest round first."
            out.append({"heading": f"{division} schedule", "content": lead, "resultsBoard": board})
    return out


def draw_summaries_scheduled(pending: list, vi: bool = False) -> list:
    """Summary rows for a draw with no completed matches yet — the
    page-top card still appears, counting scheduled matches per draw."""
    by_div: dict[str, list] = {}
    for m in pending:
        by_div.setdefault(_division(m, vi), []).append(m)
    out = []
    for division, rows in by_div.items():
        note = f"Đã lên lịch · {len(rows)} trận" if vi else f"Scheduled · {len(rows)} matches"
        out.append({"division": division, "note": note, "anchor": _anchor(division)})
    return out


def draw_summaries(finals: list, vi: bool = False) -> list:
    """One summary row per draw for the page-top card on the intro section."""
    by_div: dict[str, list] = {}
    for m in finals:
        by_div.setdefault(_division(m, vi), []).append(m)
    out = []
    for division, rows in by_div.items():
        rows = sorted(rows, key=lambda m: (int(m.get("roundNumber", 0) or 0), str(m.get("dateKey", ""))), reverse=True)
        board = _board(rows, division, vi)
        deepest = _round_label(rows[0], vi)
        if board.get("champion"):
            note = f"Hoàn tất · {len(rows)} trận" if vi else f"Complete · {len(rows)} matches"
            out.append({"division": division, "champion": board["champion"], "note": note, "anchor": _anchor(division)})
        else:
            note = (f"Đã tới {deepest} · {len(rows)} trận" if vi
                    else f"Through to the {deepest} · {len(rows)} matches")
            out.append({"division": division, "note": note, "anchor": _anchor(division)})
    return out


def draw_sections(finals: list, vi: bool = False) -> list:
    """One section per division with EVERY completed match, latest round first.

    Readers search for the whole draw ("ppa brisbane results"); the old 20-row
    cap left the page showing only the last rounds and none of the early ones.
    Matches ship as the structured resultsBoard; renderers fall back to the
    prose lead in `content` only, so no listItems are emitted for draws.
    """
    by_div: dict[str, list] = {}
    for m in finals:
        by_div.setdefault(_division(m, vi), []).append(m)
    out = []
    for division, rows in by_div.items():
        rows.sort(key=lambda m: (int(m.get("roundNumber", 0) or 0), str(m.get("dateKey", ""))), reverse=True)
        board = _board(rows, division, vi)
        champion = board.get("champion")
        if vi:
            lead = (f"Vô địch: {champion}. " if champion else "Chưa có nhà vô địch. ") + f"{len(rows)} trận đã kết thúc, vòng mới nhất ở trên."
            out.append({"heading": f"Kết quả {division}", "content": lead, "resultsBoard": board})
        else:
            lead = (f"Champion: {champion}. " if champion else "No champion yet. ") + f"{len(rows)} completed matches, latest round first."
            out.append({"heading": f"{division} results", "content": lead, "resultsBoard": board})
    return out


# SERP byte budgets, mirrored by the hard CI gate
# (src/content/blog/__tests__/seo-byte-budget.test.ts): the renderer truncates
# titles at 60 UTF-8 bytes and descriptions at 160 (functions/_lib/html.ts),
# so generated SEO strings are clamped HERE, at generation time. A long event
# name ("PPA World Championships", 2026-10-24) otherwise ships an ellipsised
# title and turns main CI red on the next results refresh.
SEO_TITLE_MAX_BYTES = 60
SEO_DESCRIPTION_MAX_BYTES = 160


def clamp_seo_bytes(text: str, limit: int) -> str:
    """Clamp `text` to `limit` UTF-8 bytes at a word boundary, so the string
    still reads naturally — never mid-word, never half a diacritic."""
    if len(text.encode("utf-8")) <= limit:
        return text
    cut = text.encode("utf-8")[:limit].decode("utf-8", errors="ignore")
    head, sep, _ = cut.rpartition(" ")
    return (head if sep else cut).rstrip(" :|—–-·")


def package(event: dict, feed: dict, now: datetime) -> dict:
    matches = feed["matches"]
    finals = [m for m in matches if m["status"] in {"final", "completed", "finished", "walkover", "retired"}]
    live = [m for m in matches if m["status"] == "live"]
    upcoming = [m for m in matches if m["status"] == "scheduled"]
    # The stamp says "Vietnam time", so make it true whatever tz the caller's clock is in.
    now = now.astimezone(ZoneInfo("Asia/Ho_Chi_Minh"))
    stamp_en = now.strftime("%B %-d, %Y, %H:%M Vietnam time")
    stamp_vi = now.strftime("%H:%M ngày %-d/%-m/%Y (giờ Việt Nam)")
    name, venue = event.get("name") or event["title"], event.get("venue", "the official tournament venue")
    source = event["source"]
    # `name` usually already ends in the year; appending it again shipped "… 2026 Results 2026".
    year = str(event.get("start_date") or now.year)[:4]
    base = name.removesuffix(f" {year}")
    # search_name = how people actually query the event (GSC 10/2026: "ppa chicago results"
    # had 4x the impressions of the sponsor-name query), so it leads the title when set.
    alias = event.get("search_name")
    en_meta = clamp_seo_bytes(f"{alias} Results {year}: {base} Scores" if alias else f"{base} Results {year} | Daily Scores", SEO_TITLE_MAX_BYTES)
    vi_meta = clamp_seo_bytes(f"Kết quả {alias} {year}: {base}" if alias else f"Kết quả {base} {year} mỗi ngày", SEO_TITLE_MAX_BYTES)
    en_h = f"{alias} results: {name} daily scores" if alias else f"{name} results and daily scores"
    en_desc = clamp_seo_bytes((f"{alias} results: " if alias else "") + f"{name} results and daily scores from the official PPA feed, checked by ThePickleHub.", SEO_DESCRIPTION_MAX_BYTES)
    vi_desc = clamp_seo_bytes(f"Kết quả {base} {year} từ feed PPA chính thức, được ThePickleHub kiểm chứng.", SEO_DESCRIPTION_MAX_BYTES)
    related = event.get("related") or []
    en_links = [{"text": "Official event scores", "path": source}] + [{"text": r["en"], "path": r["path"]} for r in related]
    vi_links = [{"text": "Nguồn điểm số chính thức", "path": source}] + [{"text": r["vi"], "path": r["vi_path"]} for r in related]
    pending = live + upcoming
    if finals:
        en_draw, vi_draw = draw_sections(finals), draw_sections(finals, True)
        en_summary, vi_summary = draw_summaries(finals), draw_summaries(finals, True)
    elif pending:
        # No completed match yet: the page must still ship the structured
        # format — summary card + fixture boards for every scheduled match
        # — not the old prose fallback (Cường's ruling, 2026-10-24).
        en_draw, vi_draw = draw_sections_scheduled(pending), draw_sections_scheduled(pending, True)
        en_summary, vi_summary = draw_summaries_scheduled(pending), draw_summaries_scheduled(pending, True)
    else:
        en_draw = [{"heading": "Confirmed results", "content": "No final result has been published in the official feed yet."}]
        vi_draw = [{"heading": "Kết quả đã xác nhận", "content": "Nguồn chính thức chưa công bố kết quả chung cuộc nào."}]
        en_summary, vi_summary = [], []
    en_live = [_match_line(m) for m in pending[:10]] or ["No match is currently marked live or scheduled in the official feed."]
    vi_live = [_match_line(m, True) for m in pending[:10]] or ["Nguồn chính thức hiện không đánh dấu trận nào đang diễn ra hoặc sắp đấu."]
    # The prose status list only survives when completed draws anchor the
    # page; next to fixture boards it would just duplicate them.
    en_status = [{"heading": "Live and upcoming status", "content": "The current feed status is listed below. Scheduled matchups are not results and must not be read as winners.", "listItems": en_live}] if finals else []
    vi_status = [{"heading": "Trận đang đấu và sắp đấu", "content": "Trạng thái hiện tại của feed được ghi dưới đây. Trận scheduled chưa phải kết quả.", "listItems": vi_live}] if finals else []
    en_sections = [
        {"heading": en_h, "content": f"Last updated: {stamp_en}. ThePickleHub publishes this {name} results page from the official PPA scores feed for {event['dates_en']} at {venue}. The feed currently contains {len(matches)} matches, including {len(finals)} completed or final records and {len(live)} live records. A missing score remains unconfirmed until the official feed supplies it.", "internalLinks": en_links, "resultsSummary": en_summary},
        *en_draw,
        *en_status,
        {"heading": "How to read this update", "content": f"ThePickleHub checks the event id, match status, two-team structure and unique winner flag before updating this page. The page is checked every few hours during the event and refreshed whenever the source snapshot changes. Event dates: {event['dates_en']}. Venue: {venue}. Official source: {source}."},
    ]
    vi_sections = [
        {"heading": f"Kết quả {base} {year}", "content": f"Cập nhật: {stamp_vi}. ThePickleHub đăng trang kết quả {base} {year} từ feed điểm số chính thức của PPA cho thời gian {event['dates_vi']} tại {venue}. Feed hiện có {len(matches)} trận, gồm {len(finals)} bản ghi đã kết thúc/chung cuộc và {len(live)} bản ghi đang diễn ra. Tỷ số chưa có trong nguồn vẫn được ghi là chưa xác minh.", "internalLinks": vi_links, "resultsSummary": vi_summary},
        *vi_draw,
        *vi_status,
        {"heading": "Cách kiểm chứng cập nhật", "content": f"ThePickleHub kiểm tra event id, trạng thái trận, cấu trúc hai đội và cờ người thắng duy nhất trước khi cập nhật. Trong thời gian giải, trang được kiểm tra vài giờ một lần và cập nhật ngay khi snapshot nguồn thay đổi. Thời gian giải: {event['dates_vi']}. Địa điểm: {venue}. Nguồn chính thức: {source}."},
    ]
    faq_en = [{"question": "Where do these results come from?", "answer": f"The official PPA scores feed: {source}."}, {"question": "Are scheduled matches final results?", "answer": "No. Only an official final or completed status with one winner is presented as a result."}, {"question": "When is this page updated?", "answer": "Every few hours while the event is on, whenever the verified official score snapshot changes."}]
    faq_vi = [{"question": "Kết quả lấy từ đâu?", "answer": f"Từ feed điểm số PPA chính thức: {source}."}, {"question": "Trận scheduled có phải kết quả không?", "answer": "Không. Chỉ bản ghi final hoặc completed có đúng một người thắng mới được trình bày là kết quả."}, {"question": "Trang cập nhật khi nào?", "answer": "Vài giờ một lần trong thời gian giải, mỗi khi snapshot điểm số chính thức đã kiểm chứng thay đổi."}]
    package = {"verdict": "NEW", "unverified": [], "slug": event["slug"], "tags": event.get("tags", ["pickleball", "results", "2026"]), "ctaPath": "/live", "ctaLabel": {"en": "Follow live scores on ThePickleHub", "vi": "Theo dõi điểm số trên ThePickleHub"}, "en": {"title": f"{name} Results: Daily Scores and Confirmed Winners", "metaTitle": en_meta, "metaDescription": en_desc, "sections": en_sections, "faqItems": faq_en}, "vi": {"slug": event["vi_slug"], "title": f"Kết quả {base} {year}: cập nhật hằng ngày", "metaTitle": vi_meta, "metaDescription": vi_desc, "excerpt": f"Kết quả {base} {year} cập nhật từ nguồn điểm số PPA chính thức.", "focusKeyword": f"kết quả {base.lower()} {year}", "sections": vi_sections, "faqItems": faq_vi}}
    # Keep the editorial hero attached to every future source-driven refresh.
    if event.get("hero_image"):
        package["heroImage"] = event["hero_image"]
    return package


def write_source(pkg: dict, event: dict, today: str) -> None:
    post = REPO / "src/content/blog/posts" / f"{pkg['slug']}.ts"
    published = pkg.get("publishedDate", today)
    post_text = w.post_ts(pkg, today, f"Verified tournament results generated from {event['source']}")
    post_text = post_text.replace(f'"publishedDate": "{today}"', f'"publishedDate": "{published}"', 1)
    post.write_text(post_text, encoding="utf-8")
    metadata = REPO / "src/content/blog/metadata.ts"
    text = metadata.read_text(encoding="utf-8")
    entry = w.metadata_entry(pkg, today).replace(f'"publishedDate": "{today}"', f'"publishedDate": "{published}"', 1)
    anchor = "export const blogMetadata: BlogPostMetadata[] = [\n"
    marker = f'    "slug": "{pkg["slug"]}"'
    if marker in text:
        start = text.index(marker); begin = text.rfind("  {\n", 0, start); end = text.index("\n  },\n", start) + len("\n  },\n")
        text = text[:begin] + entry + text[end:]
    else:
        text = text.replace(anchor, anchor + entry, 1)
    metadata.write_text(text, encoding="utf-8")
    subprocess.run(["node", "scripts/gen-blog-barrel.mjs"], cwd=REPO, check=True)


def fingerprint_path(event: dict) -> Path:
    state_root = Path(os.environ.get("PICKLEHUB_TEAM_HOME", str(Path.home() / "Library" / "Application Support" / "PickleHub" / "team-v2")))
    return state_root / "tournament-fingerprints" / f"{event['key']}.sha256"


def should_publish(event: dict, fingerprint: str) -> bool:
    path = fingerprint_path(event)
    return not path.exists() or path.read_text().strip() != fingerprint


def remember(event: dict, fingerprint: str) -> None:
    path = fingerprint_path(event); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(fingerprint + "\n")


def _upsert_vi(pkg: dict) -> None:
    """Write the VI twin before the deploy, matching the existing blog flow."""
    from team_supervisor import BASE, secret
    vi = pkg["vi"]
    key = secret("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("supabase_service_credential_missing")
    query = urllib.parse.quote(vi["slug"], safe="")
    req = urllib.request.Request(BASE + f"vi_blog_posts?select=slug&slug=eq.{query}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as response:
        exists = json.loads(response.read() or "[]")
    row = {"title": vi["title"], "meta_title": vi["metaTitle"], "meta_description": vi["metaDescription"],
           "excerpt": vi["excerpt"], "content_html": w.vi_html(vi), "author_name": "ThePickleHub",
           "category": "giải đấu", "focus_keyword": vi["focusKeyword"], "faq_items": vi["faqItems"],
           "alternate_en_slug": pkg["slug"], "status": "published", "skip_email_blast": True,
           "updated_at": datetime.now(timezone.utc).isoformat()}
    if pkg.get("heroImage"):
        row["cover_image_url"] = "https://www.thepicklehub.net" + pkg["heroImage"]["src"]
    if not exists:
        row.update(slug=vi["slug"], published_at=datetime.now(timezone.utc).isoformat())
    method = "PATCH" if exists else "POST"
    path = f"vi_blog_posts?slug=eq.{query}" if exists else "vi_blog_posts"
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(row, ensure_ascii=False).encode(), headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError("vi_row_write_failed")


def _sync_main() -> None:
    """Rebase local main onto origin/main; never leave a half-finished rebase behind."""
    if subprocess.run(["git", "pull", "--rebase", "--quiet", "origin", "main"], cwd=REPO).returncode:
        subprocess.run(["git", "rebase", "--abort"], cwd=REPO)
        raise RuntimeError("autopublish_rebase_failed")


# --- Publish guard + pipeline fingerprint (incident 2026-10-24) -----------
# The supervisor is a long-lived process that imports this module ONCE; a
# checkout pull updates the disk but not the code already in RAM, so on
# 2026-10-24 the 01:00 slot regenerated a results page with the pre-redesign
# writer and silently overwrote the structured results board with prose.
# Two defences, both cheap and deterministic:
#
# 1. _assert_results_boards: when the official feed contains completed
#    matches, the package AND the written post file MUST carry structured
#    resultsBoard sections. A stale/broken generator fails loudly here
#    (the coverage layer turns the exception into a blocked task + alert)
#    instead of committing a format regression. Events with no completed
#    match yet are exempt — the prose fallback section is legitimate then.
_FINAL_STATUSES = {"final", "completed", "finished", "walkover", "retired"}


def _assert_results_boards(pkg: dict, feed: dict, post_text: str | None = None) -> None:
    finals = [m for m in feed["matches"] if m["status"] in _FINAL_STATUSES]
    if not finals:
        return
    for lang in ("en", "vi"):
        if not any("resultsBoard" in section for section in pkg[lang]["sections"]):
            raise RuntimeError(f"results_board_missing_in_package:{lang}")
    if post_text is not None and "resultsBoard" not in post_text:
        raise RuntimeError("results_board_missing_in_output")


# 2. PIPELINE_FINGERPRINT: sha256 over the pipeline source files, computed
#    ONCE at import time — i.e. over the code this process actually loaded,
#    not the (possibly newer) files on disk. publish_event stamps it into
#    the commit message as "[pipeline:<fp12>]" so the ops freshness check
#    can compare the running pipeline against main 1:1 instead of inferring
#    staleness from output shape.
_PIPELINE_FILES = ("scripts/blog/tournament_results_autopublish.py",
                   "scripts/ops/team_wriai.py",
                   "scripts/ops/team_tournament_coverage.py")


def _pipeline_fingerprint() -> str:
    h = hashlib.sha256()
    for rel in _PIPELINE_FILES:
        try:
            h.update((REPO / rel).read_bytes())
        except OSError:
            h.update(f"missing:{rel}".encode())
    return h.hexdigest()[:12]


PIPELINE_FINGERPRINT = _pipeline_fingerprint()

def publish_event(event: dict, now: datetime | None = None, push: bool = True) -> dict:
    """Fetch, validate and publish one changed official score snapshot.

    A clean checkout on ``main`` is required for push.  This prevents a
    scheduled job from overwriting an editor's work.  ``push=False`` is useful
    for QA and unit tests and leaves a reviewable local change only.
    """
    now = now or datetime.now(timezone.utc)
    feed, fingerprint = fetch(event["result_source"], event["event_id"])
    if not should_publish(event, fingerprint):
        return {"status": "unchanged", "fingerprint": fingerprint}
    status = subprocess.run(["git", "status", "--porcelain"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    branch = subprocess.run(["git", "branch", "--show-current"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    if status or branch != "main":
        raise RuntimeError("autopublish_checkout_not_clean_main")
    if push:
        # PR merges land on origin between our runs; without this every push
        # after 15/10 was rejected non-fast-forward and EN froze for 3 days.
        _sync_main()
    today = now.astimezone(timezone.utc).date().isoformat()
    pkg = package(event, feed, now)
    # The first publication date is stable; only updatedDate changes thereafter.
    pkg["publishedDate"] = event.get("published", event["start_date"])
    _assert_results_boards(pkg, feed)
    write_source(pkg, event, today)
    post_text = (REPO / "src/content/blog/posts" / f"{pkg['slug']}.ts").read_text(encoding="utf-8")
    _assert_results_boards(pkg, feed, post_text)
    _upsert_vi(pkg)
    files = [f"src/content/blog/posts/{pkg['slug']}.ts", "src/content/blog/metadata.ts", "src/content/blog/posts/all.ts"]
    subprocess.run(["git", "add", "--", *files], cwd=REPO, check=True)
    subprocess.run(["git", "commit", "-m", f"content(blog): update {pkg['slug']} [pipeline:{PIPELINE_FINGERPRINT}]"], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    if push:
        if subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=REPO).returncode:
            _sync_main()  # someone merged between our pull and push: rebase once, retry
            subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=REPO, check=True)
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    remember(event, fingerprint)
    # What production must serve once the deploy lands; checked by team_tournament_coverage.verify_live.
    marker = pkg["en"]["sections"][0]["content"].split(". ", 1)[0]
    return {"status": "published", "fingerprint": fingerprint, "head": head, "pushed": push, "slug": pkg["slug"], "marker": marker}
