#!/usr/bin/env python3
"""Publish a verified tournament score snapshot as an EN + VI post.

This is deliberately deterministic: it only accepts the event's official PPA
scores feed, validates the event id and final-match winners, and regenerates the
same four blog surfaces used by the normal blog pipeline.  It never guesses a
score.  The caller may run it repeatedly; an unchanged feed is a no-op, and so
is a feed whose rendered page differs from main only by the publish timestamp
(updatedDate and the "Last updated" / "Cập nhật" sentence).  Those fields move
on every run, so committing them redeploys main without a new score, status,
or match count.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import string
import subprocess
import sys
import tempfile
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


def write_source(pkg: dict, event: dict, today: str, root: Path | None = None) -> None:
    root = root or REPO
    post = root / "src/content/blog/posts" / f"{pkg['slug']}.ts"
    published = pkg.get("publishedDate", today)
    post_text = w.post_ts(pkg, today, f"Verified tournament results generated from {event['source']}")
    post_text = post_text.replace(f'"publishedDate": "{today}"', f'"publishedDate": "{published}"', 1)
    post.write_text(post_text, encoding="utf-8")
    metadata = root / "src/content/blog/metadata.ts"
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
    subprocess.run(["node", str(root / "scripts/gen-blog-barrel.mjs")], cwd=root, check=True)


def fingerprint_path(event: dict) -> Path:
    return _team_home() / "tournament-fingerprints" / f"{event['key']}.sha256"


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


def _team_home() -> Path:
    return Path(os.environ.get("PICKLEHUB_TEAM_HOME", str(Path.home() / "Library" / "Application Support" / "PickleHub" / "team-v2")))


# --- Dedicated publish worktree (incident 2026-10-25/26) -------------------
# publish_event used to require the editor's working checkout to be clean on
# main. One unrelated dirty file (Localizable.xcstrings, rewritten by Xcode
# during an app build) silently blocked EVERY results publish for a full
# finals day: the coverage layer only recorded blocked/RuntimeError. The
# pipeline now publishes from its own git worktree under the team home,
# reset to origin/main on every run. The working checkout's state — dirty
# files, another branch, unpushed editor work — can no longer block or be
# disturbed by results publishing.
class PublishWorktreeError(RuntimeError):
    """The dedicated publish worktree could not be prepared."""


class _PushRejected(Exception):
    """The publish commit was created but origin moved; regenerate once."""


def _publish_worktree_path() -> Path:
    return _team_home() / "publish-worktree"


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)


def _prepare_publish_worktree(push: bool) -> Path:
    wt = _publish_worktree_path()
    if wt.resolve() == REPO.resolve() or REPO.resolve() in wt.resolve().parents:
        raise PublishWorktreeError("publish worktree must live outside the working checkout")
    if not (wt / ".git").exists():
        if wt.exists() and any(wt.iterdir()):
            raise PublishWorktreeError(f"publish worktree path occupied by non-worktree content: {wt}")
        fetched = _git(REPO, "fetch", "--quiet", "origin", "main")
        if fetched.returncode:
            raise PublishWorktreeError(f"publish worktree initial fetch failed: {fetched.stderr.strip()[:200]}")
        made = _git(REPO, "worktree", "add", "--detach", str(wt), "origin/main")
        if made.returncode:
            # A previous worktree directory may have been deleted without
            # unregistering; prune stale registrations and retry once.
            _git(REPO, "worktree", "prune")
            made = _git(REPO, "worktree", "add", "--detach", str(wt), "origin/main")
        if made.returncode:
            raise PublishWorktreeError(f"git worktree add failed: {made.stderr.strip()[:200]}")
    if push:
        fetched = _git(wt, "fetch", "--quiet", "origin", "main")
        if fetched.returncode:
            raise PublishWorktreeError(f"publish worktree fetch failed: {fetched.stderr.strip()[:200]}")
        # The worktree is pipeline-owned: any leftover from a crashed run is
        # disposable by definition, so reset hard instead of gating on it.
        reset = _git(wt, "reset", "--hard", "--quiet", "origin/main")
        if reset.returncode:
            raise PublishWorktreeError(f"publish worktree reset failed: {reset.stderr.strip()[:200]}")
        cleaned = _git(wt, "clean", "-fdq")
        if cleaned.returncode:
            raise PublishWorktreeError(f"publish worktree clean failed: {cleaned.stderr.strip()[:200]}")
    return wt


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


# Publish timestamps move on every run even when the rendered page did not.
# World Championships refreshes on 2026-10-28/29 (938ea281, d5cfb5c3,
# 50d9644b) committed nothing else: the feed hash changed, the match list
# did not, and each commit redeployed main. Strip only these three shapes
# — the updatedDate field and the two opening stamp sentences — so a score,
# status, or match-count edit on the same line still counts as content.
_UPDATED_DATE_RE = re.compile(r'"updatedDate": "\d{4}-\d{2}-\d{2}"')
_LAST_UPDATED_EN_RE = re.compile(r"Last updated: [^.\n]*\.")
_LAST_UPDATED_VI_RE = re.compile(r"Cập nhật: [^.\n]*\.")


def _strip_publish_timestamps(text: str) -> str:
    text = _UPDATED_DATE_RE.sub('"updatedDate": "<date>"', text)
    text = _LAST_UPDATED_EN_RE.sub("Last updated: <stamp>.", text)
    return _LAST_UPDATED_VI_RE.sub("Cập nhật: <stamp>.", text)


def _diff_is_timestamps_only(diff: str) -> bool:
    """True when every changed line in a ``git diff -U0`` is a publish
    timestamp. An empty diff (nothing to commit) is the same no-op.
    A new file, a reorder, or any other edit is not."""
    removed: list[str] = []
    added: list[str] = []
    for line in diff.splitlines():
        if (line.startswith("diff --git ") or line.startswith("index ")
                or line.startswith("@@") or line.startswith("new file ")
                or line.startswith("deleted file ") or line.startswith("similarity ")
                or line.startswith("rename ") or line.startswith("old mode")
                or line.startswith("new mode") or line.startswith("\\")
                or line.startswith("--- a/") or line.startswith("--- /dev/null")
                or line.startswith("+++ b/") or line.startswith("+++ /dev/null")):
            continue
        if line.startswith("+"):
            added.append(line[1:])
        elif line.startswith("-"):
            removed.append(line[1:])
    if len(removed) != len(added):
        return False
    return all(_strip_publish_timestamps(old) == _strip_publish_timestamps(new)
               for old, new in zip(removed, added))


def _git_utf8(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, encoding="utf-8")


def _working_tree_is_timestamps_only(root: Path, files: list[str]) -> bool:
    """Compare the files write_source just wrote with HEAD.

    Untracked paths are a first publish (git diff hides them), so they are
    never a timestamp no-op."""
    untracked = _git_utf8(root, "ls-files", "--others", "--exclude-standard", "--", *files)
    if untracked.returncode:
        raise PublishWorktreeError(f"publish worktree status failed: {untracked.stderr.strip()[:200]}")
    if untracked.stdout.strip():
        return False
    diff = _git_utf8(root, "diff", "--unified=0", "--no-ext-diff", "HEAD", "--", *files)
    if diff.returncode:
        raise PublishWorktreeError(f"publish worktree diff failed: {diff.stderr.strip()[:200]}")
    return _diff_is_timestamps_only(diff.stdout)


def _publish_once(root: Path, event: dict, feed: dict, now: datetime, push: bool) -> tuple[dict, str] | None:
    """Generate, write and commit one snapshot inside the publish worktree.

    Returns None when the only difference from HEAD is the publish
    timestamp. The caller records the feed fingerprint and does not push.
    """
    today = now.astimezone(timezone.utc).date().isoformat()
    pkg = package(event, feed, now)
    # The first publication date is stable; only updatedDate changes thereafter.
    pkg["publishedDate"] = event.get("published", event["start_date"])
    _assert_results_boards(pkg, feed)
    write_source(pkg, event, today, root=root)
    post_text = (root / "src/content/blog/posts" / f"{pkg['slug']}.ts").read_text(encoding="utf-8")
    _assert_results_boards(pkg, feed, post_text)
    files = [f"src/content/blog/posts/{pkg['slug']}.ts", "src/content/blog/metadata.ts", "src/content/blog/posts/all.ts"]
    if _working_tree_is_timestamps_only(root, files):
        # Drop the timestamp rewrite so the worktree stays on the published
        # copy. checkout does not delete untracked files; a timestamps-only
        # result never includes one.
        restored = _git(root, "checkout", "--quiet", "--", *files)
        if restored.returncode:
            raise PublishWorktreeError(f"publish worktree restore failed: {restored.stderr.strip()[:200]}")
        return None
    _upsert_vi(pkg)
    added = _git(root, "add", "--", *files)
    if added.returncode:
        raise PublishWorktreeError(f"publish worktree add failed: {added.stderr.strip()[:200]}")
    # The daemon's environment normally provides a git identity; if the
    # machine has none configured, supply a labeled bot identity for this
    # commit only instead of failing the publish.
    commit_args = ["commit", "-m", f"content(blog): update {pkg['slug']} [pipeline:{PIPELINE_FINGERPRINT}]"]
    if not _git(root, "config", "user.email").stdout.strip():
        commit_args = ["-c", "user.name=PickleHub Results Bot", "-c", "user.email=bot@thepicklehub.net", *commit_args]
    committed = _git(root, *commit_args)
    if committed.returncode:
        raise PublishWorktreeError(f"publish worktree commit failed: {committed.stderr.strip()[:200]}")
    head = _git(root, "rev-parse", "HEAD").stdout.strip()
    if push:
        pushed = _git(root, "push", "origin", "HEAD:main")
        if pushed.returncode:
            raise _PushRejected(pushed.stderr.strip()[:200])
        head = _git(root, "rev-parse", "HEAD").stdout.strip()
    return pkg, head


# --- Re-exec when the in-memory code is stale (incident 2026-10-24) ------
# Defence 2 above (the fingerprint stamp) DETECTED the stale-code lag; this
# removes it. The first version (#950) compared the loaded fingerprint
# against the files around __file__ — the working checkout — but that tree
# is the wrong reference: since #941 moved publishing into a dedicated
# worktree, NOTHING pulls the working checkout any more, so its files never
# change, the comparison never diverged, and the re-exec never fired
# (diagnosed on the Mac, 2026-10-27: checkout frozen at the last manual
# pull while main moved on). The publish worktree is the one tree that IS
# guaranteed current — _prepare_publish_worktree fetches and hard-resets
# it to origin/main on every publish — so the comparison and the child
# process both anchor THERE: after preparing the worktree, publish_event
# compares the fingerprint of the code this process LOADED
# (PIPELINE_FINGERPRINT, captured at import) with the fingerprint of the
# pipeline files inside the worktree. On a mismatch the publish is
# delegated to a fresh child process running the worktree's copy of this
# script, and the child's result is returned verbatim — the same tick
# publishes with the new code instead of the next one. The child is marked
# with an env flag so it can never delegate again (no loop: if yet another
# merge lands mid-run, the child publishes with its loaded code and the
# following tick catches up). A failed child is a LOUD failure — never a
# silent fallback to generating with stale code.
_REEXEC_ENV = "TPH_AUTOPUBLISH_REEXEC"
_REEXEC_TIMEOUT = 900


def _worktree_pipeline_fingerprint(root: Path) -> str:
    """Fingerprint of the pipeline files inside the publish worktree —
    the freshest tree available at publish time (reset to origin/main by
    _prepare_publish_worktree), as opposed to the possibly frozen working
    checkout this process was imported from."""
    h = hashlib.sha256()
    for rel in _PIPELINE_FILES:
        try:
            h.update((root / rel).read_bytes())
        except OSError:
            h.update(f"missing:{rel}".encode())
    return h.hexdigest()[:12]


def _should_delegate_publish(root: Path) -> bool:
    return os.environ.get(_REEXEC_ENV) != "1" and _worktree_pipeline_fingerprint(root) != PIPELINE_FINGERPRINT


def _delegate_publish(root: Path, event: dict, now: datetime, push: bool) -> dict:
    """Re-run this publish in a fresh process running the worktree's copy
    of this script (which imports the rest of the pipeline from the
    worktree too, so the whole child runs the new code).

    The event travels as JSON (it originates from the coverage config
    JSON) and the result comes back through a file, because the publish
    path itself may print (the node barrel step inherits stdout)."""
    script = root / "scripts/blog/tournament_results_autopublish.py"
    if not script.exists():
        raise RuntimeError("reexec_publish_failed:worktree_script_missing")
    with tempfile.TemporaryDirectory(prefix="autopublish-reexec-") as td:
        payload_path = Path(td) / "payload.json"
        result_path = Path(td) / "result.json"
        payload_path.write_text(json.dumps({
            "event": event,
            "now": now.isoformat(),
            "push": push,
            "result_path": str(result_path),
        }), encoding="utf-8")
        env = dict(os.environ, **{_REEXEC_ENV: "1"})
        try:
            proc = subprocess.run(
                [sys.executable, str(script), "--reexec-publish", str(payload_path)],
                capture_output=True, text=True, timeout=_REEXEC_TIMEOUT, env=env)
        except subprocess.TimeoutExpired:
            raise RuntimeError("reexec_publish_timeout") from None
        if result_path.exists():
            result = json.loads(result_path.read_text(encoding="utf-8"))
            if "error" in result:
                raise RuntimeError(f"reexec_publish_failed:{result['error']}")
            return result
        tail = (proc.stderr or proc.stdout or "").strip()[-300:]
        raise RuntimeError(f"reexec_publish_failed:exit={proc.returncode}:{tail}")


def _maybe_delegate_publish(root: Path, event: dict, now: datetime, push: bool) -> dict | None:
    """The child's verbatim result (flagged reexec) when the worktree's
    code has moved past the code this process loaded, else None."""
    if not _should_delegate_publish(root):
        return None
    result = _delegate_publish(root, event, now, push)
    result["reexec"] = True
    return result


def _reexec_main(payload_path: str) -> int:
    """Child entry point: publish with freshly imported code and write the
    result (or the error) to the payload's result_path for the parent."""
    payload = json.loads(Path(payload_path).read_text(encoding="utf-8"))
    result_path = Path(payload["result_path"])
    try:
        result = publish_event(payload["event"],
                               now=datetime.fromisoformat(payload["now"]),
                               push=bool(payload["push"]))
    except Exception as exc:  # noqa: BLE001 — reported to the parent verbatim
        result_path.write_text(json.dumps({"error": f"{type(exc).__name__}:{exc}"}), encoding="utf-8")
        return 1
    result_path.write_text(json.dumps(result), encoding="utf-8")
    return 0


def publish_event(event: dict, now: datetime | None = None, push: bool = True) -> dict:
    """Fetch, validate and publish one changed official score snapshot.

    Publishing happens in a dedicated git worktree (see
    _prepare_publish_worktree), never in the editor's working checkout, so
    unrelated local state cannot block it.  ``push=False`` is useful for QA
    and unit tests and leaves a reviewable commit in the worktree only.
    A snapshot that would change only ``updatedDate`` and the opening
    "Last updated" / "Cập nhật" sentence returns status ``unchanged``
    with reason ``timestamps_only`` and does not commit.
    """
    now = now or datetime.now(timezone.utc)
    feed, fingerprint = fetch(event["result_source"], event["event_id"])
    if not should_publish(event, fingerprint):
        return {"status": "unchanged", "fingerprint": fingerprint}
    root = _prepare_publish_worktree(push)
    delegated = _maybe_delegate_publish(root, event, now, push)
    if delegated is not None:
        # The worktree (reset to origin/main above) carries newer pipeline
        # code than this process loaded: a fresh process running the
        # worktree's code published instead, in this same tick.
        return delegated
    try:
        published = _publish_once(root, event, feed, now, push)
    except _PushRejected:
        # Someone merged between our fetch and push: reset the worktree to
        # the new origin/main and regenerate once on top of it — re-checking
        # first whether that merge also moved the pipeline code itself.
        root = _prepare_publish_worktree(True)
        delegated = _maybe_delegate_publish(root, event, now, push)
        if delegated is not None:
            return delegated
        published = _publish_once(root, event, feed, now, push)
    if published is None:
        # The feed hash moved but the page did not. Remember the hash so the
        # next identical snapshot short-circuits, and leave updatedDate alone.
        remember(event, fingerprint)
        return {"status": "unchanged", "fingerprint": fingerprint, "reason": "timestamps_only"}
    pkg, head = published
    remember(event, fingerprint)
    # What production must serve once the deploy lands; checked by team_tournament_coverage.verify_live.
    marker = pkg["en"]["sections"][0]["content"].split(". ", 1)[0]
    # `pipeline` = the fingerprint of the code that ACTUALLY generated this
    # publish; the ops freshness check compares it (and the commit stamp)
    # against main. `reexec` False here: this process generated it itself.
    return {"status": "published", "fingerprint": fingerprint, "head": head, "pushed": push,
            "slug": pkg["slug"], "marker": marker, "pipeline": PIPELINE_FINGERPRINT, "reexec": False}


if __name__ == "__main__":
    # Internal only: the re-exec child spawned by _delegate_publish.
    if len(sys.argv) == 3 and sys.argv[1] == "--reexec-publish":
        raise SystemExit(_reexec_main(sys.argv[2]))
    raise SystemExit("usage: tournament_results_autopublish.py --reexec-publish <payload.json>")
