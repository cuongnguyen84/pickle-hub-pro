"""Wriai publish gate: no network, no model, no live writes."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from team_store import Store
import team_wriai as w
import team_progress
from team_actions import approve, state

INBOX = "11111111-2222-3333-4444-555555555555"


def lang(opening, extra=""):
    body = " ".join(["Verified sentence about courts and players."] * 30)
    return {"title": "Pickleball courts in Can Tho 2026" + extra, "metaTitle": "Pickleball Courts in Can Tho 2026" + extra,
            "metaDescription": "Where to play pickleball in Can Tho in 2026: ten courts from the ThePickleHub directory, by district.",
            "slug": "san-pickleball-can-tho", "excerpt": "Mười sân pickleball ở Cần Thơ.",
            "sections": [{"heading": "Answer", "content": opening}] +
                        [{"heading": f"Part {i}", "content": body} for i in range(4)],
            "faqItems": [{"question": f"Q{i}?", "answer": f"A{i}."} for i in range(3)]}


def package(**over):
    pkg = {"verdict": "NEW", "seo_score": 7, "unverified": [], "slug": "pickleball-courts-can-tho-2026",
           "tags": ["can tho", "pickleball courts", "vietnam"], "ctaPath": "/san",
           "ctaLabel": {"en": "Find a court", "vi": "Tìm sân"},
           "en": lang("ThePickleHub lists 10 pickleball courts in Can Tho as of 24 September 2026."),
           "vi": lang("ThePickleHub ghi nhận 10 sân pickleball tại Cần Thơ (24/9/2026) <b>.")}
    pkg.update(over)
    return pkg


class GateTests(unittest.TestCase):
    def test_clean_package_passes(self):
        self.assertEqual(w.problems(package(), set(), set()), [])

    def test_each_hard_rule_blocks(self):
        cases = {
            "verdict": package(verdict="MERGE:san-pickleball-tphcm"),
            "unverified": package(unverified=["giá thuê"]),
            "taken": package(slug="pickleball-la-gi"),
            "banned": package(en={**lang("ThePickleHub x"), "title": "The Pickle Hub guide"}),
            "geo": package(en=lang("Can Tho has courts.")),
            "bytes": package(vi={**lang("ThePickleHub"), "metaTitle": "Sân pickleball Cần Thơ 2026: danh sách đầy đủ theo quận"}),
            "link": package(ctaPath="https://evil.example"),
        }
        for name, pkg in cases.items():
            with self.subTest(name):
                self.assertTrue(w.problems(pkg, {"pickleball-la-gi"}, set()))

    def test_table_rows_do_not_trip_the_banned_string_check(self):
        en = lang("ThePickleHub lists courts.")
        en["sections"][1]["table"] = {"caption": "c", "headers": ["a", "b"], "rows": [["x", "y"], ["z", "w"]]}
        self.assertEqual(w.problems(package(en=en), set(), set()), [])
        en["sections"][1]["table"]["rows"][0][0] = "[[VERIFY]]"
        self.assertTrue(w.problems(package(en=en), set(), set()))

    def test_generated_files_carry_the_package(self):
        ts = w.post_ts(package(), "2026-09-24", "note")
        obj = json.loads(ts.split("const post: BlogPost = ", 1)[1].rsplit(";\n\nexport default post;", 1)[0])
        self.assertEqual(obj["content"]["en"]["metaTitle"], package()["en"]["metaTitle"])
        entry = w.metadata_entry(package(), "2026-09-24")
        meta = json.loads(entry.strip().rstrip(","))
        self.assertEqual(meta["metaTitleEn"], obj["content"]["en"]["metaTitle"])
        self.assertEqual(meta["metaDescriptionVi"], obj["content"]["vi"]["metaDescription"])

    def test_hero_image_flows_to_post_metadata_and_vi_cover(self):
        pkg = package(heroImage={"src": w.hero_path("x"), "alt": "a"})
        ts = w.post_ts(pkg, "2026-09-25", "n")
        self.assertIn('"heroImage"', ts)
        self.assertEqual(json.loads(w.metadata_entry(pkg, "2026-09-25").strip().rstrip(","))["heroImage"]["src"],
                         "/images/blog/x-hero.webp")
        self.assertNotIn("heroImage", w.metadata_entry(package(), "2026-09-25"))
        class Team:
            ICT = None
            def rest(self, path): return []
        with patch.object(w, "_write") as write, patch.object(w, "datetime"):
            w.insert_vi(Team(), pkg)
        self.assertEqual(write.call_args[0][3]["cover_image_url"], "/images/blog/x-hero.webp")

    def test_fetch_hero_writes_a_1200px_webp(self):
        import io
        from PIL import Image
        buf = io.BytesIO(); Image.new("RGB", (1792, 1024), "blue").save(buf, "PNG")
        class Resp(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *a): pass
        class Team:
            def rest(self, path): return [{"featured_image": {"url": "https://cdn.wriai.com/a.webp"}}]
        task = {"dedupe": f"schedule:wriai:{INBOX}"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(w.urllib.request, "urlopen", return_value=Resp(buf.getvalue())):
            hero = w.fetch_hero(Team(), task, package(), Path(tmp))
            out = Image.open(Path(tmp) / "public" / hero["src"].lstrip("/"))
            self.assertEqual((out.format, out.width), ("WEBP", 1200))

    def test_vi_html_escapes_model_text(self):
        self.assertIn("&lt;b&gt;", w.vi_html(package()["vi"]))
        self.assertNotIn("<b>", w.vi_html(package()["vi"]))

    def test_insert_vi_is_idempotent(self):
        class Team:
            ICT = None
            def __init__(self, rows): self.rows = rows
            def rest(self, path): return self.rows
        with patch.object(w, "_write") as write:
            w.insert_vi(Team([{"slug": "san-pickleball-can-tho"}]), package())
            write.assert_not_called()
            with patch.object(w, "datetime") as dt:
                dt.now.return_value.isoformat.return_value = "2026-09-25"
                w.insert_vi(Team([]), package())
            self.assertEqual(write.call_args[0][1:3], ("POST", "vi_blog_posts"))
            self.assertEqual(write.call_args[0][3]["alternate_en_slug"], package()["slug"])

    def test_db_writes_are_limited_to_two_shapes(self):
        for method, path in (("POST", "news_items"), ("PATCH", "wriai_inbox?id=eq.x"), ("DELETE", "vi_blog_posts")):
            with self.subTest(path), self.assertRaises(ValueError):
                w._write(None, method, path, {})


class FlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name))
        tid = self.store.task(f"schedule:wriai:{INBOX}", "editorial", "Wriai → EN", "awaiting_review", {})
        self.task = self.store.db.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        tree = Path(self.tmp.name) / "wt"
        (tree / "docs/agent-drafts").mkdir(parents=True)
        (tree / "docs/agent-drafts/wriai-x.md").write_text(
            "# Review\n\n```json wriai-package\n" + json.dumps(package(), ensure_ascii=False) + "\n```\n")
        self.result = {"worktree": str(tree), "paths": ["docs/agent-drafts/wriai-x.md"]}

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def ready(self):
        with patch.object(w, "_existing", return_value=(set(), set())):
            return w.review_ready(self.store, self.task, self.result)

    def test_clean_draft_arms_the_approve_button_and_approval_unlocks_the_package(self):
        self.assertIn("ĐỦ ĐIỀU KIỆN ĐĂNG", self.ready())
        current = state(self.store, self.task["id"])
        self.assertEqual(current["phase"], "awaiting_deploy")
        keyboard = team_progress.reply_keyboard(f"T{self.task['id']}", self.store)["inline_keyboard"]
        button = next(b for row in keyboard for b in row if b.get("callback_data", "").startswith("deploy|"))
        self.assertIn("Duyệt đăng bài", button["text"])
        self.assertFalse(any("url" in b for row in keyboard for b in row))
        self.assertIn("đã nhận duyệt", approve(self.store, f"T{self.task['id']}", button["callback_data"].split("|")[2]))
        self.assertEqual(w.load_package(self.store, self.task)["slug"], package()["slug"])

    def test_dirty_draft_gets_no_button(self):
        draft = Path(self.result["worktree"]) / "docs/agent-drafts/wriai-x.md"
        draft.write_text("```json wriai-package\n" + json.dumps(package(unverified=["giá"])) + "\n```")
        self.assertIn("CHƯA ĐỦ ĐIỀU KIỆN", self.ready())
        self.assertNotEqual(state(self.store, self.task["id"]).get("phase"), "awaiting_deploy")

    def test_owner_override_waives_facts_and_queues_publish_without_button(self):
        draft = Path(self.result["worktree"]) / "docs/agent-drafts/wriai-x.md"
        draft.write_text("```json wriai-package\n" + json.dumps(package(verdict="DROP", unverified=["giá"])) + "\n```")
        self.assertIn("CHƯA ĐỦ ĐIỀU KIỆN", self.ready())
        self.assertIn("ĐĂNG KHÔNG KIỂM CHỨNG", w.owner_publish(self.store, f"T{self.task['id']}"))
        row = self.store.db.execute("SELECT * FROM tasks WHERE id=?", (self.task["id"],)).fetchone()
        self.assertEqual(row["status"], "queued")
        self.assertIn("LỆNH CHỦ SỞ HỮU", json.loads(row["evidence"])["request"])
        self.assertIn("ĐĂNG THEO LỆNH ANH", self.ready())
        current = state(self.store, self.task["id"])
        self.assertEqual((current["phase"], current["kind"]), ("queued", "wriai"))
        self.assertEqual(w.load_package(self.store, self.task)["verdict"], "DROP")

    def test_owner_override_keeps_structural_checks(self):
        pkg = package(verdict="DROP", unverified=["giá"], en=lang("Can Tho has courts."))
        self.assertTrue(w.problems(pkg, set(), set(), override=True))

    def test_owner_publish_rejects_non_wriai_tasks(self):
        tid = self.store.task("telegram:1", "chief", "x", "awaiting_review", {"request": "x"})
        self.assertIn("không phải bài Wriai", w.owner_publish(self.store, f"T{tid}"))

    def test_stale_approval_is_rejected(self):
        self.ready()
        self.assertIn("đã cũ", approve(self.store, f"T{self.task['id']}", "0" * 12))


if __name__ == "__main__":
    unittest.main()
