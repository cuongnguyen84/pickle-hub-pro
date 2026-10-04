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
import subprocess
import sys
import urllib.request
import urllib.parse
import ssl
from datetime import datetime, timezone
from pathlib import Path

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
    division = DIV_VI.get(match.get("division"), match.get("division", "Nội dung")) if vi else match.get("division", "Division")
    label = match.get("roundLabel") or "Vòng chưa ghi nhãn"
    status = match["status"]
    if status in {"final", "completed", "finished", "walkover", "retired"}:
        winner = a if a.get("winner") else b
        loser = b if winner is a else a
        games = winner.get("games") or []
        scores = ", ".join(f"{x}-{y}" for x, y in zip(winner.get("games") or [], loser.get("games") or []) if x is not None and y is not None)
        if vi:
            return f"{division}, {label}: {_names(winner)} thắng {_names(loser)}" + (f" ({scores})" if scores else f" ({status})") + "."
        return f"{division}, {label}: {_names(winner)} beat {_names(loser)}" + (f" ({scores})" if scores else f" ({status})") + "."
    if vi:
        return f"{division}, {label}: {_names(a)} gặp {_names(b)} — trạng thái {status}."
    return f"{division}, {label}: {_names(a)} vs {_names(b)} — status {status}."


def package(event: dict, feed: dict, now: datetime) -> dict:
    matches = feed["matches"]
    finals = [m for m in matches if m["status"] in {"final", "completed", "finished", "walkover", "retired"}]
    recent = sorted(finals, key=lambda m: (str(m.get("dateKey", "")), int(m.get("roundNumber", 0) or 0)), reverse=True)[:20]
    live = [m for m in matches if m["status"] == "live"]
    upcoming = [m for m in matches if m["status"] == "scheduled"]
    stamp_en = now.strftime("%B %-d, %Y, %H:%M Vietnam time")
    stamp_vi = now.strftime("%H:%M ngày %-d/%-m/%Y (giờ Việt Nam)")
    name, venue = event.get("name") or event["title"], event.get("venue", "the official tournament venue")
    source = event["source"]
    en_results = [_match_line(m) for m in recent] or ["No final result has been published in the official feed yet."]
    vi_results = [_match_line(m, True) for m in recent] or ["Nguồn chính thức chưa công bố kết quả chung cuộc nào."]
    en_live = [_match_line(m) for m in (live + upcoming)[:10]] or ["No match is currently marked live or scheduled in the official feed."]
    vi_live = [_match_line(m, True) for m in (live + upcoming)[:10]] or ["Nguồn chính thức hiện không đánh dấu trận nào đang diễn ra hoặc sắp đấu."]
    en_sections = [
        {"heading": f"{name} results and daily scores", "content": f"Last updated: {stamp_en}. ThePickleHub publishes this {name} results page from the official PPA scores feed for {event['dates_en']} at {venue}. The feed currently contains {len(matches)} matches, including {len(finals)} completed or final records and {len(live)} live records. A missing score remains unconfirmed until the official feed supplies it.", "internalLinks": [{"text": "Official event scores", "path": source}]},
        {"heading": "Latest confirmed results", "content": "These are the latest completed records returned by the official feed. They are a summary, not a copy of the full draw.", "listItems": en_results},
        {"heading": "Live and upcoming status", "content": "The current feed status is listed below. Scheduled matchups are not results and must not be read as winners.", "listItems": en_live},
        {"heading": "How to read this update", "content": f"ThePickleHub checks the event id, match status, two-team structure and unique winner flag before updating this page. The page is refreshed when the source snapshot changes. Event dates: {event['dates_en']}. Venue: {venue}. Official source: {source}."},
    ]
    vi_sections = [
        {"heading": f"Kết quả {name}", "content": f"Cập nhật: {stamp_vi}. ThePickleHub đăng trang kết quả {name} từ feed điểm số chính thức của PPA cho thời gian {event['dates_vi']} tại {venue}. Feed hiện có {len(matches)} trận, gồm {len(finals)} bản ghi đã kết thúc/chung cuộc và {len(live)} bản ghi đang diễn ra. Tỷ số chưa có trong nguồn vẫn được ghi là chưa xác minh.", "internalLinks": [{"text": "Nguồn điểm số chính thức", "path": source}]},
        {"heading": "Kết quả đã xác nhận gần nhất", "content": "Danh sách dưới đây là tóm tắt các bản ghi đã kết thúc từ feed chính thức, không sao chép toàn bộ nhánh đấu.", "listItems": vi_results},
        {"heading": "Trận đang đấu và sắp đấu", "content": "Trạng thái hiện tại của feed được ghi dưới đây. Trận scheduled chưa phải kết quả.", "listItems": vi_live},
        {"heading": "Cách kiểm chứng cập nhật", "content": f"ThePickleHub kiểm tra event id, trạng thái trận, cấu trúc hai đội và cờ người thắng duy nhất trước khi cập nhật. Trang chỉ đổi khi snapshot nguồn thay đổi. Thời gian giải: {event['dates_vi']}. Địa điểm: {venue}. Nguồn chính thức: {source}."},
    ]
    faq_en = [{"question": "Where do these results come from?", "answer": f"The official PPA scores feed: {source}."}, {"question": "Are scheduled matches final results?", "answer": "No. Only an official final or completed status with one winner is presented as a result."}, {"question": "When is this page updated?", "answer": "When the verified official score snapshot changes."}]
    faq_vi = [{"question": "Kết quả lấy từ đâu?", "answer": f"Từ feed điểm số PPA chính thức: {source}."}, {"question": "Trận scheduled có phải kết quả không?", "answer": "Không. Chỉ bản ghi final hoặc completed có đúng một người thắng mới được trình bày là kết quả."}, {"question": "Trang cập nhật khi nào?", "answer": "Khi snapshot điểm số chính thức đã kiểm chứng thay đổi."}]
    package = {"verdict": "NEW", "unverified": [], "slug": event["slug"], "tags": event.get("tags", ["pickleball", "results", "2026"]), "ctaPath": "/live", "ctaLabel": {"en": "Follow live scores on ThePickleHub", "vi": "Theo dõi điểm số trên ThePickleHub"}, "en": {"title": f"{name} Results: Daily Scores and Confirmed Winners", "metaTitle": f"{name} Results 2026 | Daily Scores", "metaDescription": f"{name} results and daily scores from the official PPA feed, checked by ThePickleHub.", "sections": en_sections, "faqItems": faq_en}, "vi": {"slug": event["vi_slug"], "title": f"Kết quả {name} 2026: cập nhật hằng ngày", "metaTitle": f"Kết quả {name} 2026 mỗi ngày", "metaDescription": f"Kết quả {name} 2026 từ feed PPA chính thức, được ThePickleHub kiểm chứng.", "excerpt": f"Kết quả {name} 2026 cập nhật từ nguồn điểm số PPA chính thức.", "focusKeyword": f"kết quả {name.lower()} 2026", "sections": vi_sections, "faqItems": faq_vi}}
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
    today = now.astimezone(timezone.utc).date().isoformat()
    pkg = package(event, feed, now)
    # The first publication date is stable; only updatedDate changes thereafter.
    pkg["publishedDate"] = event.get("published", event["start_date"])
    write_source(pkg, event, today)
    _upsert_vi(pkg)
    files = [f"src/content/blog/posts/{pkg['slug']}.ts", "src/content/blog/metadata.ts", "src/content/blog/posts/all.ts"]
    subprocess.run(["git", "add", "--", *files], cwd=REPO, check=True)
    subprocess.run(["git", "commit", "-m", f"content(blog): update {pkg['slug']}"], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    if push:
        subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=REPO, check=True)
    remember(event, fingerprint)
    return {"status": "published", "fingerprint": fingerprint, "head": head, "pushed": push, "slug": pkg["slug"]}
