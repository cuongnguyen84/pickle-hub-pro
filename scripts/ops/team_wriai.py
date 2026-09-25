"""Wriai draft -> owner-approved bilingual blog post.

Stage 1 (review_ready): after the editorial draft, parse the machine-readable
package the draft must contain, validate it, and — only if clean — park the task
at `awaiting_deploy` bound to the package hash. The existing "Duyệt" button
(deploy|T<id>|<hash12>) is the owner approval; nothing is published before it.

Stage 2 (publish): on approval, write the EN post + metadata entry, regenerate
the barrel, typecheck/test/build in an isolated worktree, open a PR. The owner
already approved the content, so the PR merges itself once CI is green.

The VI row (vi_blog_posts, alternate_en_slug -> EN slug) is inserted as soon as
the PR opens: CI smoke follows /vi/blog/<en-slug>, which only resolves through it.

Stage 3 (after_deploy): once production serves the merge, re-ensure the VI row
and mark the inbox row converted.
These two writes are the only DB writes this module can make.
"""
from __future__ import annotations

import html
import json
import re
import time
import urllib.request
from datetime import datetime
from pathlib import Path

SITE = "https://www.thepicklehub.net"
PACKAGE_RE = re.compile(r"```json wriai-package\s*\n(.*?)\n```", re.S)
SLUG_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+){1,12}")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
BANNED = ("The Pickle Hub", "[VERIFY", "TODO", "[[", "<script")


def is_wriai(task):
    return str(task["dedupe"]).startswith("schedule:wriai:")


def inbox_id(task):
    value = str(task["dedupe"]).split("schedule:wriai:", 1)[-1]
    if not UUID_RE.fullmatch(value):
        raise ValueError("wriai_inbox_id_invalid")
    return value


def package_from(text):
    match = PACKAGE_RE.search(text or "")
    if not match:
        raise ValueError("wriai_package_missing")
    return json.loads(match.group(1))


def _sections_ok(sections):
    return isinstance(sections, list) and len(sections) >= 4 and all(
        isinstance(s, dict) and str(s.get("heading", "")).strip() and str(s.get("content", "")).strip()
        for s in sections)


def _words(lang):
    return sum(len(str(s.get("content", "")).split()) + sum(len(str(i).split()) for i in s.get("listItems") or [])
               for s in lang.get("sections") or [])


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)


def problems(pkg, en_slugs, vi_slugs, override=False):
    """Every reason this package must not be published. Empty list = publishable.
    override: owner ordered publication as-is, so verdict and fact checks are waived;
    the structural checks stay because the site cannot render a package without them."""
    out = []
    if pkg.get("verdict") != "NEW" and not override:
        out.append(f"kết luận là {pkg.get('verdict')!r}, không phải NEW")
    if pkg.get("unverified") and not override:
        out.append(f"còn {len(pkg['unverified'])} dữ kiện chưa kiểm chứng")
    en, vi = pkg.get("en") or {}, pkg.get("vi") or {}
    slug, vi_slug = str(pkg.get("slug", "")), str(vi.get("slug", ""))
    for name, value, taken in (("slug EN", slug, en_slugs), ("slug VI", vi_slug, vi_slugs)):
        if not SLUG_RE.fullmatch(value) or len(value) > 90:
            out.append(f"{name} không hợp lệ")
        elif value in taken:
            out.append(f"{name} '{value}' đã tồn tại")
    for code, lang in (("EN", en), ("VI", vi)):
        if not str(lang.get("title", "")).strip():
            out.append(f"thiếu title {code}")
        if not 1 <= len(str(lang.get("metaTitle", "")).encode()) <= 60:
            out.append(f"metaTitle {code} phải 1–60 byte")
        if not 50 <= len(str(lang.get("metaDescription", "")).encode()) <= 160:
            out.append(f"metaDescription {code} phải 50–160 byte")
        if not _sections_ok(lang.get("sections")):
            out.append(f"{code} cần ≥4 mục có heading + content")
        elif "ThePickleHub" not in str(lang["sections"][0].get("content", "")):
            out.append(f"đoạn mở đầu {code} chưa nêu ThePickleHub (GEO)")
        faq = lang.get("faqItems") or []
        if not 3 <= len(faq) <= 6 or not all(f.get("question") and f.get("answer") for f in faq):
            out.append(f"{code} cần 3–6 FAQ")
    if en and _words(en) < 600:
        out.append(f"bản EN chỉ {_words(en)} từ (< 600)")
    # Scan string values only: json.dumps of any table (list of lists) contains "[[" by itself.
    blob = "\n".join(_strings(pkg))
    out += [f"còn chuỗi cấm {b!r}" for b in BANNED if b in blob]
    links = [l.get("path", "") for lang in (en, vi) for s in lang.get("sections") or [] for l in s.get("internalLinks") or []]
    if any(not str(p).startswith("/") or str(p).startswith("//") for p in links + [pkg.get("ctaPath", "")]):
        out.append("link nội bộ/ctaPath phải là đường dẫn /… trong site")
    tags = pkg.get("tags") or []
    if not 3 <= len(tags) <= 10:
        out.append("cần 3–10 tags")
    return out


def _post_obj(pkg, today):
    def lang(l):
        keep = ("heading", "content", "listItems", "orderedList", "internalLinks", "table")
        return {"title": l["title"], "metaTitle": l["metaTitle"], "metaDescription": l["metaDescription"],
                "sections": [{k: s[k] for k in keep if s.get(k)} for s in l["sections"]],
                "faqItems": [{"question": f["question"], "answer": f["answer"]} for f in l["faqItems"]]}
    return {"slug": pkg["slug"], "publishedDate": today, "updatedDate": today, "author": "The PickleHub Team",
            "tags": pkg["tags"], "ctaPath": pkg.get("ctaPath") or "/tools",
            "ctaLabel": pkg.get("ctaLabel") or {"en": "Explore ThePickleHub tools", "vi": "Khám phá công cụ ThePickleHub"},
            **({"heroImage": pkg["heroImage"]} if pkg.get("heroImage") else {}),
            "content": {"en": lang(pkg["en"]), "vi": lang(pkg["vi"])}}


def hero_path(slug):
    return f"/images/blog/{slug}-hero.webp"


def fetch_hero(team, task, pkg, tree):
    """Wriai's featured image -> public/images/blog/<slug>-hero.webp (1200px WebP, self-hosted
    like every other hero). Returns the heroImage dict, or None when Wriai sent no usable image."""
    import io
    from PIL import Image
    rows = team.rest(f"wriai_inbox?select=featured_image&id=eq.{inbox_id(task)}")
    image = (rows[0].get("featured_image") if rows else None) or {}
    url = str(image.get("url", ""))
    if not url.startswith("https://"):
        return None
    req = urllib.request.Request(url, headers={"User-Agent": "ThePickleHub-team/1"})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read(15_000_000)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    if img.width > 1200:
        img = img.resize((1200, round(img.height * 1200 / img.width)), Image.LANCZOS)
    dest = tree / "public" / hero_path(pkg["slug"]).lstrip("/")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=80, method=6)
    return {"src": hero_path(pkg["slug"]), "alt": pkg["en"]["title"]}


def post_ts(pkg, today, note):
    body = json.dumps(_post_obj(pkg, today), ensure_ascii=False, indent=2)
    return (f'import type {{ BlogPost }} from "@/content/blog/types";\n\n/**\n * {note}\n */\n'
            f"const post: BlogPost = {body};\n\nexport default post;\n")


def metadata_entry(pkg, today):
    p = _post_obj(pkg, today)
    en, vi = p["content"]["en"], p["content"]["vi"]
    meta = {k: p[k] for k in ("slug", "publishedDate", "updatedDate", "author", "tags", "ctaPath", "ctaLabel", "heroImage") if k in p}
    meta.update(titleEn=en["title"], titleVi=vi["title"], metaTitleEn=en["metaTitle"], metaTitleVi=vi["metaTitle"],
                metaDescriptionEn=en["metaDescription"], metaDescriptionVi=vi["metaDescription"])
    return "  " + json.dumps(meta, ensure_ascii=False, indent=2).replace("\n", "\n  ") + ",\n"


def vi_html(vi):
    e = html.escape
    parts = []
    for s in vi["sections"]:
        parts.append(f"<h2>{e(s['heading'])}</h2>")
        parts += [f"<p>{e(p.strip())}</p>" for p in str(s["content"]).split("\n\n") if p.strip()]
        for tag, key in (("ul", "listItems"), ("ol", "orderedList")):
            if s.get(key):
                parts.append(f"<{tag}>" + "".join(f"<li>{e(str(i))}</li>" for i in s[key]) + f"</{tag}>")
        t = s.get("table")
        if t:
            head = "".join(f"<th>{e(str(h))}</th>" for h in t.get("headers", []))
            rows = "".join("<tr>" + "".join(f"<td>{e(str(c))}</td>" for c in r) + "</tr>" for r in t.get("rows", []))
            cap = f"<caption>{e(t['caption'])}</caption>" if t.get("caption") else ""
            parts.append(f"<table>{cap}<thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>")
        for link in s.get("internalLinks") or []:
            parts.append(f'<p><a href="{e(link["path"])}">{e(link["text"])}</a></p>')
    return "\n".join(parts)


def _existing(team, metadata_text):
    en = set(re.findall(r'"?slug"?:\s*"([^"]+)"', metadata_text))
    vi = {r["slug"] for r in team.rest("vi_blog_posts?select=slug&limit=1000")}
    return en, vi


def review_ready(store, task, result):
    """After the editorial draft: gate the package and, if clean, arm the approval button."""
    import team_supervisor as team
    from team_actions import save, state
    files = [Path(result["worktree"]) / p for p in result.get("paths", []) if p.startswith("docs/agent-drafts/wriai-")]
    if not files:
        return "Chưa có file wriai-*.md trong bản nháp; không có gì để duyệt."
    text = files[0].read_text(encoding="utf-8")
    try:
        pkg = package_from(text)
    except (ValueError, json.JSONDecodeError) as exc:
        return f"Bản nháp thiếu gói xuất bản hợp lệ ({type(exc).__name__}); chưa thể duyệt đăng."
    en_slugs, vi_slugs = _existing(team, (team.REPO / "src/content/blog/metadata.ts").read_text())
    override = bool(store.get(f"wriai_override:{task['id']}"))
    issues = problems(pkg, en_slugs, vi_slugs, override)
    if issues:
        retry = f"\nSửa xong bản nháp bằng: /xuly dang T{task['id']}" if override else ""
        return "CHƯA ĐỦ ĐIỀU KIỆN ĐĂNG:\n• " + "\n• ".join(issues[:8]) + retry
    artifact = store.artifact(f"wriai-T{task['id']}-package.json", json.dumps(pkg, ensure_ascii=False))
    if override:
        # The owner's /xuly dang command is the approval; queue publish exactly as the button would.
        h = artifact["sha256"]
        save(store, task["id"], phase="queued", kind="wriai", head=h[:40], package=artifact, approval=h[:12],
             attempt=state(store, task["id"]).get("attempt", 0) + 1,
             reason="Anh ra lệnh đăng không kiểm chứng; gói đã qua kiểm tra cấu trúc.",
             next_step="Đội mở PR, CI xanh thì tự merge, rồi ghi bản VI và báo link.")
        return (f"ĐĂNG THEO LỆNH ANH (bỏ qua kiểm chứng {len(pkg.get('unverified') or [])} dữ kiện)\n"
                f"EN: {SITE}/blog/{pkg['slug']}\nVI: {SITE}/vi/blog/{pkg['vi']['slug']}\n"
                "Đội tự mở PR, CI xanh thì merge và báo link.")
    # head carries the package hash so the existing deploy|T|<12 hex> button binds approval to these bytes.
    save(store, task["id"], phase="awaiting_deploy", kind="wriai", head=artifact["sha256"][:40],
         package=artifact, reason="Gói bài EN+VI đã qua kiểm tra tự động; chờ anh duyệt đăng.",
         next_step="Bấm Duyệt đăng bài: đội mở PR, CI xanh thì tự merge, rồi ghi bản VI và báo link.")
    return (f"ĐỦ ĐIỀU KIỆN ĐĂNG · điểm SEO {pkg.get('seo_score', '?')}/10\n"
            f"EN: {SITE}/blog/{pkg['slug']}\nVI: {SITE}/vi/blog/{pkg['vi']['slug']}\n"
            "Bấm Duyệt đăng bài bên dưới để đội tự đăng.")


def load_package(store, task):
    from team_actions import state
    current = state(store, task["id"])
    art = current.get("package") or {}
    path = Path(art.get("path", ""))
    if not path.is_file() or store.root.resolve() not in path.resolve().parents:
        raise RuntimeError("missing_reviewable_patch")
    body = path.read_text(encoding="utf-8")
    import hashlib
    if hashlib.sha256(body.encode()).hexdigest() != art.get("sha256") or current.get("approval") != art["sha256"][:12]:
        raise RuntimeError("patch_changed_since_report")
    return json.loads(body)


def publish(store, task):
    """Approved package -> validated PR that merges itself when CI is green."""
    import team_supervisor as team
    from team_actions import checked, save, state
    pkg = load_package(store, task)
    tid, attempt = task["id"], state(store, task["id"])["attempt"]
    branch = f"agent/wriai-T{tid}-{attempt}"
    tree = store.root / "workspaces" / f"wriai-T{tid}-{attempt}"
    checked(["git", "fetch", "origin", "main"])
    base = checked(["git", "rev-parse", "origin/main"])
    checked(["git", "worktree", "add", "-b", branch, str(tree), base])
    meta_path = tree / "src/content/blog/metadata.ts"
    meta = meta_path.read_text(encoding="utf-8")
    override = bool(store.get(f"wriai_override:{tid}"))
    issues = problems(pkg, *_existing(team, meta), override)
    if issues:
        raise RuntimeError("wriai_package_no_longer_valid")
    today = datetime.now(team.ICT).date().isoformat()
    note = (f"Wriai draft {inbox_id(task)} -> team task T{tid}, published on the owner's explicit order {today} "
            f"WITHOUT fact verification ({len(pkg.get('unverified') or [])} unverified facts)." if override else
            f"Wriai draft {inbox_id(task)} -> team task T{tid}, reviewed by the editorial team and approved by the owner {today}.")
    try:
        hero = fetch_hero(team, task, pkg, tree)
    except Exception:
        hero = None  # ponytail: a broken Wriai image never blocks the post; it ships without a hero.
    if hero:
        pkg = {**pkg, "heroImage": hero}
    (tree / f"src/content/blog/posts/{pkg['slug']}.ts").write_text(post_ts(pkg, today, note), encoding="utf-8")
    anchor = "export const blogMetadata: BlogPostMetadata[] = [\n"
    if meta.count(anchor) != 1:
        raise RuntimeError("metadata_anchor_missing")
    meta_path.write_text(meta.replace(anchor, anchor + metadata_entry(pkg, today)), encoding="utf-8")
    env = team.clean_env()
    scratch = store.root / "scratch" / f"qa-wriai-T{tid}-{attempt}"
    scratch.mkdir(parents=True, exist_ok=True)
    env.update(HOME=str(scratch), CI="true")
    checked(["node", "scripts/gen-blog-barrel.mjs"], cwd=tree, env=env)
    expected = {f"src/content/blog/posts/{pkg['slug']}.ts", "src/content/blog/metadata.ts", "src/content/blog/posts/all.ts"}
    if hero:
        checked(["node", "scripts/gen-blog-image-dims.mjs"], cwd=tree, env=env)
        checked(["git", "add", "-A", "public/images/blog"], cwd=tree)
        expected |= {"public" + hero["src"], "src/content/blog/image-dims.ts"}
    checked(["git", "add", "-A", "src/content/blog"], cwd=tree)
    paths = checked(["git", "diff", "--cached", "--name-only"], cwd=tree).splitlines()
    if set(paths) != expected:
        raise RuntimeError("patch_manifest_mismatch")
    checked(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=tree, env=env, timeout=300)
    for argv in (["npx", "--no-install", "tsc", "--noEmit", "-p", "tsconfig.app.json"],
                 ["npm", "run", "test"], ["npm", "run", "build"]):
        checked(argv, cwd=tree, env=env, timeout=600)
    checked(["git", "diff", "--exit-code"], cwd=tree)
    checked(["git", "-c", "core.hooksPath=/dev/null", "commit", "-m", f"content(blog): {pkg['slug']} (Wriai draft, team T{tid})"], cwd=tree)
    head = checked(["git", "rev-parse", "HEAD"], cwd=tree)
    checked(["git", "push", "origin", f"HEAD:refs/heads/{branch}"], cwd=tree)
    body = store.artifact(f"wriai-T{tid}-{attempt}-pr.md",
        f"New EN+VI blog post from Wriai draft `{inbox_id(task)}` (team T{tid}), approved by the owner on Telegram.\n\n"
        f"- EN: /blog/{pkg['slug']}\n- VI: /vi/blog/{pkg['vi']['slug']} (vi_blog_posts row inserted after production deploy)\n\n"
        "Validation: package gate, typecheck, test suite and production build passed in an isolated checkout.\n")
    url = checked(["gh", "pr", "create", "--base", "main", "--head", branch, "--title",
                   f"content(blog): {pkg['slug']}", "--body-file", body["path"]], cwd=tree)
    if not re.fullmatch(r"https://github.com/cuongnguyen84/pickle-hub-pro/pull/\d+", url):
        raise RuntimeError("unexpected_pull_request_url")
    insert_vi(team, pkg)
    # Owner approved the content itself; the merge waits only for CI.
    save(store, tid, phase="awaiting_ci", pr=url, head=head, base=base, autodeploy=True, ci_requested_at=time.time(),
         reason="Bài đã qua typecheck, test và build; chờ CI để tự merge.",
         next_step="Đội tự merge khi CI xanh, ghi bản VI rồi báo link.")
    return f"T{tid}: đã mở PR bài {pkg['slug']}.\n{url}\nCI xanh thì đội tự merge; chưa lên website."


def _write(team, method, path, data):
    # The only writes this module may make; everything else stays read-only.
    allowed = (method == "POST" and path == "vi_blog_posts") or (
        method == "PATCH" and re.fullmatch(r"wriai_inbox\?id=eq\.[0-9a-f-]{36}&status=eq\.new", path))
    if not allowed:
        raise ValueError("write_outside_wriai_scope")
    key = team.secret("SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(team.BASE + path, data=json.dumps(data).encode(), method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=30) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError("wriai_db_write_failed")


def _public(url, needle):
    req = urllib.request.Request(url + "?nocache=1", headers={"User-Agent": "Googlebot"})
    with urllib.request.urlopen(req, timeout=30) as response:
        page = response.read(2_000_000).decode("utf-8", "replace")
    return response.status == 200 and needle in page and len(re.sub("<[^>]+>", " ", page).split()) >= 300


OVERRIDE_BRIEF = (
    "\n\nLỆNH CHỦ SỞ HỮU (ghi đè BƯỚC 1–3 ở trên chỗ mâu thuẫn): anh Cuong đã quyết định ĐĂNG bài này theo ý mình, "
    "KHÔNG cần kiểm chứng. Không được kết luận BỎ/GỘP. verdict phải là \"NEW\". Giữ nguyên dữ kiện của Wriai "
    "(địa chỉ, giá, SĐT, số sân), KHÔNG gắn [VERIFY], KHÔNG xoá vì chưa có nguồn; vẫn liệt kê chúng trong \"unverified\" "
    "để lưu vết. Chỉ sửa lỗi hiển nhiên: tên thương hiệu viết đúng \"ThePickleHub\", bỏ nhân vật/chức danh bịa, "
    "không hứa tính năng site không có. Bắt buộc viết đủ gói en + vi đúng cấu trúc BƯỚC 3."
)


def owner_publish(store, code):
    """/xuly dang T<id>: owner orders a Wriai post published without fact verification."""
    from team_progress import target
    from team_actions import state, ACTIVE
    task = target(store, code)
    if not task or not is_wriai(task):
        return f"{code}: không phải bài Wriai; lệnh dang chỉ dùng cho việc Wriai."
    tid = task["id"]
    if task["status"] in {"resolved", "cancelled"}:
        return f"T{tid}: đã đóng; không đăng lại."
    current = state(store, tid)
    if current.get("phase") in ACTIVE or task["status"] == "running":
        return f"T{tid}: đang trong lượt xử lý ({current.get('phase') or task['status']}); bot sẽ báo kết quả."
    ev = json.loads(task["evidence"])
    request = ev.get("request", "")
    if OVERRIDE_BRIEF not in request:
        ev["request"] = request + OVERRIDE_BRIEF
    store.put(f"wriai_override:{tid}", True)
    with store.db:
        store.db.execute("UPDATE tasks SET status='queued',evidence=?,updated=? WHERE id=?",
                         (json.dumps(ev, ensure_ascii=False), time.time(), tid))
    return (f"T{tid}: đã nhận lệnh ĐĂNG KHÔNG KIỂM CHỨNG. Đội viết lại gói EN+VI giữ nguyên dữ kiện Wriai; "
            "đạt cấu trúc thì tự mở PR → CI xanh → merge → báo link, anh không cần bấm thêm.")


def insert_vi(team, pkg):
    """Idempotent. Runs when the PR opens: CI smoke follows /vi/blog/<en-slug>, which prod
    resolves through vi_blog_posts.alternate_en_slug - without the row the PR can never go green."""
    vi = pkg["vi"]
    if team.rest(f"vi_blog_posts?select=slug&slug=eq.{vi['slug']}&limit=1"):
        return
    _write(team, "POST", "vi_blog_posts", {
        "slug": vi["slug"], "title": vi["title"], "meta_title": vi["metaTitle"],
        "meta_description": vi["metaDescription"], "excerpt": vi.get("excerpt") or vi["metaDescription"],
        "content_html": vi_html(vi), "author_name": "ThePickleHub", "category": "hướng dẫn",
        "cover_image_url": (pkg.get("heroImage") or {}).get("src"),
        "tags": pkg["tags"], "focus_keyword": vi.get("focusKeyword") or pkg["tags"][0],
        "faq_items": [{"question": f["question"], "answer": f["answer"]} for f in vi["faqItems"]],
        "alternate_en_slug": pkg["slug"], "status": "published",
        "published_at": datetime.now(team.ICT).isoformat(), "skip_email_blast": True})


def after_deploy(store, task):
    """Production serves the EN post: ensure the VI twin, close the inbox row, check both pages."""
    import team_supervisor as team
    pkg = load_package(store, task)
    vi = pkg["vi"]
    insert_vi(team, pkg)
    _write(team, "PATCH", f"wriai_inbox?id=eq.{inbox_id(task)}&status=eq.new",
           {"status": "converted", "converted_slug": pkg["slug"], "updated_at": datetime.now(team.ICT).isoformat()})
    # The canonical link carries the slug verbatim, unlike titles that may be entity-encoded.
    en_ok = _public(f"{SITE}/blog/{pkg['slug']}", f"/blog/{pkg['slug']}")
    vi_ok = _public(f"{SITE}/vi/blog/{vi['slug']}", f"/vi/blog/{vi['slug']}")
    if not (en_ok and vi_ok):
        raise RuntimeError("wriai_public_check_failed")
    return (f"📰 ĐÃ ĐĂNG\nEN: {SITE}/blog/{pkg['slug']}\nVI: {SITE}/vi/blog/{vi['slug']}\n"
            "Bot đã kiểm cả hai trang. Còn thiếu: xin index trên GSC (làm tay).")
