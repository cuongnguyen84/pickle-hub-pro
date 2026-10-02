#!/usr/bin/env python3
"""Daily results recap for a PPA Tour (US) event -> one bilingual blog post.

Reads the public scores feed the ppatour.com event page uses, summarises it
editorially (stage per division, next-round matchups, upsets, the Vietnamese
and Vietnamese-origin players, a storyline tracker) and writes the post with
the same helpers the Wriai pipeline uses. Summaries only: PPA's ToS forbids
mirroring their full results, so no complete draw tables.

  python3 scripts/blog/ppa_results_recap.py build      # write post .ts + metadata + barrel
  python3 scripts/blog/ppa_results_recap.py vi-row     # insert/refresh the vi_blog_posts row

First used for the Rate Las Vegas Open 2026 (owner asked 01/10 for a results
post updated daily). EVENT below is the only per-event config.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts/ops"))
import team_wriai as w  # noqa: E402

EVENT = {
    "id": "86926aef-0566-4fbb-87cf-a48068a9f1c6",
    "name": "Rate Las Vegas Open 2026",
    "dates_en": "September 28 – October 4, 2026",
    "dates_vi": "28/9–4/10/2026",
    "venue": "Darling Tennis Center, Las Vegas",
    "slug": "rate-las-vegas-open-2026-results",
    "vi_slug": "ket-qua-ppa-las-vegas-open-2026",
    "schedule_en": "/blog/rate-las-vegas-open-2026-schedule",
    "schedule_vi": "/vi/blog/lich-thi-dau-ppa-las-vegas-open-2026",
    "hero": {"src": "/images/blog/rate-las-vegas-open-2026-results-hero.webp",
             "alt": "Rate Las Vegas Open 2026 results at Darling Tennis Center"},
    "published": "2026-10-01",
    "tracker": "Anna Leigh Waters",
}
FEED = "https://www.ppatour.com/api/scores/?event={id}"
SOURCE = "https://www.ppatour.com/events/2026/rate-las-vegas-open/"

# Vietnam-flag players and hand-picked Vietnamese-origin players, as in
# src/content/ppa-rankings.ts (same editorial rule).
VN = {"Hien Truong": "Trương Vinh Hiển", "Quan Do": "Đỗ Minh Quân", "Sophia Nhi Huynh": "Sophia Huỳnh Trần Ngọc Nhi",
      "Hoang Nam Ly": "Lý Hoàng Nam", "Sophia Phuong Anh Tran": "Sophia Phương Anh", "Ho Tam": "Hồ Tâm",
      "Phuc Huynh": "Phúc Huỳnh", "Giang Trinh": "Trịnh Linh Giang"}
VIET_ORIGIN = {"Alix Truong": "Alix Trương", "Luc Pham": "Luc Phạm", "Jonathan Truong": "Jonathan Trương",
               "Quang Duong": "Quang Dương"}
DIV_VI = {"Men's Singles": "Đơn nam", "Women's Singles": "Đơn nữ", "Men's Doubles": "Đôi nam",
          "Women's Doubles": "Đôi nữ", "Mixed Doubles": "Đôi nam nữ"}
DIV_ORDER = ["Men's Singles", "Women's Singles", "Men's Doubles", "Women's Doubles", "Mixed Doubles"]
ROUND_VI = {"Round 64": "vòng 64", "Round 32": "vòng 32", "Round 16": "vòng 16", "Quarterfinals": "tứ kết",
            "Quarterfinal": "tứ kết", "Quarter Finals": "tứ kết", "Semifinals": "bán kết", "Semifinal": "bán kết",
            "Semi Finals": "bán kết", "Finals": "chung kết", "Final": "chung kết", "Gold Medal Match": "tranh HCV",
            "Bronze Medal Match": "tranh HCĐ"}


def rvi(label):
    return ROUND_VI.get(label, label.lower().replace("gold", "tranh HCV").replace("bronze", "tranh HCĐ"))


def fetch():
    req = urllib.request.Request(FEED.format(id=EVENT["id"]), headers={"User-Agent": "Mozilla/5.0 ThePickleHub"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def who(team, vi=False):
    names = [(VN.get(p) or VIET_ORIGIN.get(p) or p) if vi else p for p in team["players"]]
    return " / ".join(names) + (f" [{team['seed']}]" if team.get("seed") else "")


def score(winner, loser):
    return ", ".join(f"{a}-{b}" for a, b in zip(winner["games"], loser["games"]) if a is not None and (a or b))


def split(m):
    a, b = m["teams"]
    return (a, b) if a["winner"] else (b, a)


def known(m):
    return all(t["players"] for t in m["teams"])


def summarise(feed):
    by_div = {d: [m for m in feed["matches"] if m["division"] == d] for d in DIV_ORDER}
    out = {}
    for div, ms in by_div.items():
        rounds = sorted({(m["roundNumber"], m["roundLabel"]) for m in ms})
        done = [lbl for n, lbl in rounds if all(m["status"] == "final" for m in ms if m["roundNumber"] == n)]
        pending = [(n, lbl) for n, lbl in rounds if lbl not in done]
        nxt = pending[0] if pending else None
        upsets = []
        for m in ms:
            if m["status"] != "final":
                continue
            win, lose = split(m)
            if win.get("seed") and lose.get("seed") and lose["seed"] <= 8 and win["seed"] - lose["seed"] >= 8:
                upsets.append((m["roundLabel"], win, lose))
        top = max(rounds)[0] if rounds else 0
        finals = [m for m in ms if m["roundNumber"] == top and m["status"] == "final"]
        champion = split(finals[0])[0] if len(rounds) and not pending and len(finals) == 1 else None
        lineup = [m for m in ms if nxt and m["roundNumber"] == nxt[0] and known(m)]
        out[div] = {"done": done, "next": nxt[1] if nxt else None, "lineup": lineup, "upsets": upsets,
                    "champion": champion, "live": sum(m["status"] == "live" for m in ms)}
    return out


def player_matches(feed, names):
    rows = []
    for m in sorted(feed["matches"], key=lambda m: (DIV_ORDER.index(m["division"]), m["roundNumber"])):
        for i, t in enumerate(m["teams"]):
            mine = [p for p in t["players"] if p in names]
            if mine:
                rows.append((m, t, m["teams"][1 - i]))
    return rows


def vn_lines(feed, vi):
    lines = []
    for m, me, opp in player_matches(feed, set(VN) | set(VIET_ORIGIN)):
        div = DIV_VI[m["division"]] if vi else m["division"]
        rnd = rvi(m["roundLabel"]) if vi else m["roundLabel"]
        if m["status"] == "final":
            won = me["winner"]
            s = score(me, opp)
            if vi:
                lines.append(f"{div}, {rnd}: {who(me, True)} {'thắng' if won else 'thua'} {who(opp, True)} ({s}).")
            else:
                lines.append(f"{div}, {rnd}: {who(me)} {'beat' if won else 'lost to'} {who(opp)} ({s}).")
        elif opp["players"]:
            state = ("đang thi đấu với" if m["status"] == "live" else "gặp") if vi else ("playing" if m["status"] == "live" else "next faces")
            lines.append(f"{div}, {rnd}: {who(me, vi)} {state} {who(opp, vi)}.")
    return lines


def tracker_lines(feed, vi):
    name = EVENT["tracker"]
    rows = player_matches(feed, {name})
    out = []
    for m, me, opp in rows:
        div = DIV_VI[m["division"]] if vi else m["division"]
        rnd = rvi(m["roundLabel"]) if vi else m["roundLabel"]
        if m["status"] == "final":
            verb = ("thắng" if me["winner"] else "thua") if vi else ("beat" if me["winner"] else "lost to")
            out.append(f"{div}, {rnd}: {who(me, vi)} {verb} {who(opp, vi)} ({score(me, opp)}).")
        elif opp["players"]:
            out.append(f"{div}, {rnd}: {who(me, vi)} {'gặp' if vi else 'next faces'} {who(opp, vi)}.")
    return out


def build_pkg(feed, now):
    s = summarise(feed)
    stamp_en = now.strftime("%B %-d, %Y, %H:%M") + " Vietnam time"
    stamp_vi = now.strftime("%H:%M ngày %-d/%-m/%Y") + " (giờ Việt Nam)"
    champs = {d: v["champion"] for d, v in s.items() if v["champion"]}
    stage_en = "; ".join(f"{d}: " + (f"won by {who(v['champion'])}" if v["champion"] else
                         (f"{v['done'][-1]} complete" if v["done"] else "first round underway") + (f", {v['next']} next" if v["next"] and v["done"] else ""))
                         for d, v in s.items())
    stage_vi = "; ".join(f"{DIV_VI[d]}: " + (f"vô địch {who(v['champion'], True)}" if v["champion"] else
                         (f"xong {rvi(v['done'][-1])}" if v["done"] else f"đang đấu {rvi(v['next'])}") + (f", tiếp theo {rvi(v['next'])}" if v["next"] and v["done"] else ""))
                         for d, v in s.items())
    finished = len(champs) == len(DIV_ORDER)

    def div_section(d, vi):
        v = s[d]
        title = (DIV_VI[d] if vi else d)
        if v["champion"]:
            body = (f"Nhà vô địch {DIV_VI[d].lower()}: {who(v['champion'], True)}." if vi else
                    f"{d} champion: {who(v['champion'])}.")
        else:
            body = ((f"Đã xong {rvi(v['done'][-1])}. Vòng tiếp theo: {rvi(v['next'])}." if v["done"] and v["next"] else
                     f"{rvi(v['next']).capitalize()} đang diễn ra." if v["next"] else "") if vi else
                    (f"{v['done'][-1]} is complete. Next: {v['next']}." if v["done"] and v["next"] else
                     f"{v['next']} is underway." if v["next"] else ""))
        if v["upsets"]:
            ups = "; ".join(f"{(rvi(r) if vi else r)}: {who(a, vi)} {'thắng' if vi else 'beat'} {who(b, vi)}" for r, a, b in v["upsets"])
            body += (f"\n\nKết quả bất ngờ: {ups}." if vi else f"\n\nUpsets: {ups}.")
        sec = {"heading": (f"{title}: kết quả và vòng tiếp theo" if vi else f"{title}: results and what's next"), "content": body}
        if v["lineup"] and len(v["lineup"]) <= 8 and not v["champion"]:
            sec["listItems"] = [" vs ".join(who(t, vi) for t in m["teams"]) for m in v["lineup"]]
        return sec

    tl_en, tl_vi = tracker_lines(feed, False), tracker_lines(feed, True)
    vn_en, vn_vi = vn_lines(feed, False), vn_lines(feed, True)
    en_sections = [
        {"heading": f"{EVENT['name']} results: where every draw stands",
         "content": f"Last updated: {stamp_en}.\n\n"
                    f"The {EVENT['name']} runs {EVENT['dates_en']} at the {EVENT['venue']}, a PPA Tour Open worth 1,000 ranking points per title. "
                    f"This ThePickleHub results page is updated every day from the official PPA Tour scores: {stage_en}.\n\n"
                    "Scores are listed game by game from the side of the player or team named first. Seeds are in brackets. Match times and the remaining schedule "
                    "in Vietnam time are in our schedule guide, and Vietnamese and Vietnamese-origin players are tracked in their own section below.",
         "internalLinks": [{"text": "Rate Las Vegas Open 2026 schedule in Vietnam time", "path": EVENT["schedule_en"]}]},
        {"heading": "Vietnamese and Vietnamese-origin players",
         "content": ("Vietnam's Truong Vinh Hien, Do Minh Quan and Sophia Huynh Tran Ngoc Nhi made the trip to Las Vegas, "
                     "alongside Vietnamese-American Alix Truong and Luc Pham. Every match they have played or are scheduled to play:")
                    if vn_en else "No Vietnamese or Vietnamese-origin player is left in the draws.",
         **({"listItems": vn_en} if vn_en else {}),
         "internalLinks": [{"text": "PPA Tour world rankings (WPR)", "path": "/rankings"}]},
        {"heading": f"{EVENT['tracker']} and title No. 200",
         "content": (f"{EVENT['tracker']} arrived two doubles titles away from career title No. 200 on the PPA Tour and is not playing singles, "
                     "so she needs both women's doubles and mixed doubles. Her matches so far:"),
         **({"listItems": tl_en} if tl_en else {})},
        *[div_section(d, False) for d in DIV_ORDER],
    ]
    vi_sections = [
        {"heading": f"Kết quả {EVENT['name']}: tình hình từng nội dung",
         "content": f"Cập nhật: {stamp_vi}.\n\n"
                    f"{EVENT['name']} diễn ra {EVENT['dates_vi']} tại {EVENT['venue']}, giải PPA Tour hạng Open, mỗi nhà vô địch nhận 1.000 điểm xếp hạng. "
                    f"Trang kết quả này của ThePickleHub được cập nhật hằng ngày theo bảng điểm chính thức của PPA Tour: {stage_vi}.\n\n"
                    "Tỷ số ghi theo từng ván, tính từ phía tay vợt hoặc cặp được nêu trước; số trong ngoặc là hạt giống. Giờ thi đấu các vòng còn lại theo giờ Việt Nam có trong bài lịch thi đấu, "
                    "còn các tay vợt Việt Nam và gốc Việt được theo dõi riêng ở mục ngay dưới đây.",
         "internalLinks": [{"text": "Lịch thi đấu Rate Las Vegas Open 2026 theo giờ Việt Nam", "path": EVENT["schedule_vi"]}]},
        {"heading": "Tay vợt Việt Nam và gốc Việt",
         "content": ("Trương Vinh Hiển, Đỗ Minh Quân và Sophia Huỳnh Trần Ngọc Nhi của Việt Nam có mặt ở Las Vegas, "
                     "cùng hai tay vợt Mỹ gốc Việt Alix Trương và Luc Phạm. Toàn bộ các trận đã đấu và sắp đấu:")
                    if vn_vi else "Không còn tay vợt Việt Nam hay gốc Việt nào trong nhánh đấu.",
         **({"listItems": vn_vi} if vn_vi else {}),
         "internalLinks": [{"text": "Bảng xếp hạng thế giới PPA (WPR)", "path": "/vi/rankings"}]},
        {"heading": f"{EVENT['tracker']} và danh hiệu thứ 200",
         "content": (f"{EVENT['tracker']} đến Las Vegas khi chỉ còn thiếu hai danh hiệu đôi để cán mốc danh hiệu thứ 200 trên PPA Tour, "
                     "và cô không đánh đơn, nên phải vô địch cả đôi nữ lẫn đôi nam nữ. Các trận của cô tới lúc này:"),
         **({"listItems": tl_vi} if tl_vi else {})},
        *[div_section(d, True) for d in DIV_ORDER],
    ]
    faq_en = [
        {"question": "Where do these results come from?", "answer": f"From the official PPA Tour live scores for the event ({SOURCE}), summarised by ThePickleHub once a day."},
        {"question": "When is the Rate Las Vegas Open 2026 final in Vietnam time?", "answer": "The finals start at 10:00 am on Sunday, October 4 in Las Vegas, which is midnight at the start of Monday, October 5 in Vietnam."},
        {"question": "Are Vietnamese players at the Rate Las Vegas Open?", "answer": "Yes. Truong Vinh Hien, Do Minh Quan and Sophia Huynh Tran Ngoc Nhi of Vietnam entered, along with Vietnamese-American Alix Truong and Luc Pham; their results are listed on this page."},
    ]
    faq_vi = [
        {"question": "Kết quả trên trang này lấy từ đâu?", "answer": f"Từ bảng điểm trực tiếp chính thức của PPA Tour cho giải ({SOURCE}), được ThePickleHub tóm tắt mỗi ngày."},
        {"question": "Chung kết Rate Las Vegas Open 2026 mấy giờ Việt Nam?", "answer": "Chung kết bắt đầu 10:00 sáng Chủ nhật 4/10 giờ Las Vegas, tức 0:00 rạng sáng thứ Hai 5/10 giờ Việt Nam."},
        {"question": "Có tay vợt Việt Nam dự Rate Las Vegas Open không?", "answer": "Có. Trương Vinh Hiển, Đỗ Minh Quân và Sophia Huỳnh Trần Ngọc Nhi của Việt Nam tham dự, cùng hai tay vợt Mỹ gốc Việt Alix Trương và Luc Phạm; kết quả của họ được liệt kê trên trang này."},
    ]
    state_en = "Final Results" if finished else "Live Results"
    state_vi = "kết quả chung cuộc" if finished else "kết quả từng ngày"
    return {
        "verdict": "NEW", "unverified": [], "slug": EVENT["slug"],
        "tags": ["ppa tour", "las vegas open", "results", "anna leigh waters", "vietnam", "2026"],
        "ctaPath": "/live", "ctaLabel": {"en": "Follow live scores on ThePickleHub", "vi": "Theo dõi trực tiếp trên ThePickleHub"},
        "heroImage": EVENT["hero"],
        "en": {"title": f"Rate Las Vegas Open 2026 Results: {state_en}, Vietnamese Players",
               "metaTitle": f"Rate Las Vegas Open 2026 Results ({'Final' if finished else 'Daily'})",
               "metaDescription": "Rate Las Vegas Open 2026 results, updated daily: every draw's stage, upsets, Anna Leigh Waters' title 200 and the Vietnamese players.",
               "sections": en_sections, "faqItems": faq_en},
        "vi": {"slug": EVENT["vi_slug"], "title": f"Kết quả Rate Las Vegas Open 2026: {state_vi}, tay vợt Việt Nam",
               "metaTitle": "Kết quả PPA Las Vegas Open 2026 mỗi ngày",
               "metaDescription": "Kết quả Rate Las Vegas Open 2026 cập nhật hằng ngày: từng nội dung, kết quả bất ngờ, Anna Leigh Waters và tay vợt Việt Nam.",
               "excerpt": f"Kết quả Rate Las Vegas Open 2026 ({EVENT['dates_vi']}) cập nhật hằng ngày: {stage_vi}.",
               "focusKeyword": "kết quả las vegas open 2026", "sections": vi_sections, "faqItems": faq_vi},
    }


def write_files(pkg, today):
    post = REPO / f"src/content/blog/posts/{pkg['slug']}.ts"
    note = (f"Daily results recap generated by scripts/blog/ppa_results_recap.py from the official PPA Tour "
            f"scores feed ({SOURCE}). Re-run `build` to refresh; do not hand-edit.")
    published = EVENT["published"]
    body = w.post_ts(pkg, today, note).replace(f'"publishedDate": "{today}"', f'"publishedDate": "{published}"')
    post.write_text(body, encoding="utf-8")
    meta_path = REPO / "src/content/blog/metadata.ts"
    meta = meta_path.read_text(encoding="utf-8")
    entry = w.metadata_entry(pkg, today).replace(f'"publishedDate": "{today}"', f'"publishedDate": "{published}"')
    start = meta.find(f'    "slug": "{pkg["slug"]}"')
    if start == -1:
        anchor = "export const blogMetadata: BlogPostMetadata[] = [\n"
        assert meta.count(anchor) == 1
        meta = meta.replace(anchor, anchor + entry)
    else:
        begin = meta.rfind("  {\n", 0, start)
        end = meta.index("\n  },\n", start) + len("\n  },\n")
        meta = meta[:begin] + entry + meta[end:]
    meta_path.write_text(meta, encoding="utf-8")
    subprocess.run(["node", "scripts/gen-blog-barrel.mjs"], cwd=REPO, check=True, stdout=subprocess.DEVNULL)


def vi_row(pkg):
    import team_supervisor as team
    vi = pkg["vi"]
    row = {"slug": vi["slug"], "title": vi["title"], "meta_title": vi["metaTitle"], "meta_description": vi["metaDescription"],
           "excerpt": vi["excerpt"], "content_html": w.vi_html(vi), "author_name": "ThePickleHub", "category": "giải đấu",
           "cover_image_url": pkg["heroImage"]["src"], "tags": pkg["tags"], "focus_keyword": vi["focusKeyword"],
           "faq_items": vi["faqItems"], "alternate_en_slug": pkg["slug"], "status": "published", "skip_email_blast": True}
    key = team.secret("SUPABASE_SERVICE_ROLE_KEY")
    exists = team.rest(f"vi_blog_posts?select=slug&slug=eq.{vi['slug']}")
    if exists:
        method, path = "PATCH", f"vi_blog_posts?slug=eq.{vi['slug']}"
        row = {k: v for k, v in row.items() if k not in ("slug", "status")}
        row["updated_at"] = datetime.now(timezone.utc).isoformat()
    else:
        method, path = "POST", "vi_blog_posts"
        row["published_at"] = datetime.now(timezone.utc).isoformat()
    req = urllib.request.Request(team.BASE + path, data=json.dumps(row).encode(), method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=30) as r:
        print(method, r.status)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    now = datetime.now(timezone(timedelta(hours=7)))
    feed = fetch()
    pkg = build_pkg(feed, now)
    words = w._words(pkg["en"])
    issues = [i for i in w.problems(pkg, set(), set()) if "đã tồn tại" not in i]
    print(f"EN words {words}, VI words {w._words(pkg['vi'])}, issues {issues}")
    if issues:
        sys.exit(1)
    if cmd == "build":
        write_files(pkg, now.date().isoformat())
    elif cmd == "vi-row":
        vi_row(pkg)
    elif cmd == "print":
        print(json.dumps(pkg, ensure_ascii=False, indent=1)[:6000])


if __name__ == "__main__":
    main()
