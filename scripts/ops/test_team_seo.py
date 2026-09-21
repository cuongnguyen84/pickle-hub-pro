"""Kiểm ba bộ đo SEO bằng HTML/JSON dựng sẵn — không chạm mạng, không tốn token."""
import importlib.util
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import team_seo as seo

SITE = seo.SITE

INDEX = f"""<sitemapindex>
  <sitemap><loc>{SITE}/sitemap-blog.xml</loc></sitemap>
  <sitemap><loc>{SITE}/sitemap-players.xml</loc></sitemap>
</sitemapindex>"""

BLOG_MAP = f"""<urlset>
  <url><loc>{SITE}/blog/a</loc>
    <xhtml:link rel="alternate" hreflang="en" href="{SITE}/blog/a"/>
    <xhtml:link rel="alternate" hreflang="vi" href="{SITE}/vi/blog/a-vi"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/blog/a"/>
  </url>
  <url><loc>{SITE}/vi/blog/a-vi</loc>
    <xhtml:link rel="alternate" hreflang="en" href="{SITE}/blog/a"/>
    <xhtml:link rel="alternate" hreflang="vi" href="{SITE}/vi/blog/a-vi"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/blog/a"/>
  </url>
</urlset>"""

PLAYER_MAP = f"<urlset><url><loc>{SITE}/nguoi-choi/x</loc></url></urlset>"


BLOG_ALTS = (("en", "/blog/a"), ("vi", "/vi/blog/a-vi"), ("x-default", "/blog/a"))


def page(url, canonical=None, alts=BLOG_ALTS, words=400, title=None):
    alts = BLOG_ALTS if alts is None else alts
    title = title or "Tiêu đề " + url.rsplit("/", 1)[-1]
    links = "".join(f'<link rel="alternate" hreflang="{l}" href="{SITE}{h}"/>' for l, h in alts)
    return (f'<html><head><title>{title}</title>'
            f'<link rel="canonical" href="{canonical or url}"/>{links}'
            f'<script>var noise = "{"x " * 50}";</script></head>'
            f'<body>{"từ " * words}</body></html>')


def responder(pages):
    """pages: {url: (status, html)}. Sitemap luôn trả sẵn."""
    fixed = {f"{SITE}/sitemap.xml": (200, INDEX),
             f"{SITE}/sitemap-blog.xml": (200, BLOG_MAP),
             f"{SITE}/sitemap-players.xml": (200, PLAYER_MAP)}

    def get(url, **kwargs):
        if url in fixed:
            return fixed[url]
        # Trang mặc định phải khớp hreflang mà sitemap khai cho chính nó, nếu không
        # mọi test đều dính hreflang_mismatch của trang không liên quan.
        return pages.get(url, (200, page(url, alts=() if "/nguoi-choi/" in url else None)))
    return get


class CrawlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.recheck = Path(self.tmp.name) / "recheck.json"

    def tearDown(self):
        self.tmp.cleanup()

    def run_crawl(self, pages, day=0, per=2, recheck=None):
        return seo.crawl_observation(get=responder(pages), day=day, per_segment=per, recheck=recheck)

    def test_failed_url_is_rechecked_until_it_passes(self):
        """Mẫu xoay vòng không được làm phát hiện hôm qua tự biến mất hôm nay."""
        bad = f"{SITE}/blog/a"
        broken = {bad: (200, page(bad, words=71))}
        self.assertIn("blog:thin_body", self.run_crawl(broken, day=0, recheck=self.recheck)["problems"])
        self.assertEqual(json.loads(self.recheck.read_text()), [bad])
        # Ngày sau mẫu bốc trang khác, nhưng URL hỏng vẫn được đo lại.
        still = self.run_crawl(broken, day=1, per=1, recheck=self.recheck)
        self.assertIn("blog:thin_body", still["problems"])
        self.assertIn(bad, still["rechecked"])
        # Sửa xong thì việc mới đóng, và URL rời danh sách đo lại.
        fixed = self.run_crawl({}, day=1, per=1, recheck=self.recheck)
        self.assertEqual(fixed["problems"], {})
        self.assertEqual(json.loads(self.recheck.read_text()), [])

    def test_healthy_site_has_no_problems(self):
        result = self.run_crawl({f"{SITE}/nguoi-choi/x": (200, page(f"{SITE}/nguoi-choi/x", alts=(), words=80))})
        self.assertEqual(result["problems"], {})
        self.assertEqual(result["corpus_size"], 3)

    def test_thin_article_body_is_reported(self):
        # Lỗi 05/08: bài blog trả 71 từ thay vì 1518 — thẻ meta vẫn đúng.
        url = f"{SITE}/blog/a"
        result = self.run_crawl({url: (200, page(url, words=71))})
        self.assertIn("blog:thin_body", result["problems"])

    def test_entity_page_below_article_floor_stays_quiet(self):
        """Sàn theo loại trang: hồ sơ 80 từ là bình thường, bài 80 từ là lỗi."""
        url = f"{SITE}/nguoi-choi/x"
        result = self.run_crawl({url: (200, page(url, alts=(), words=80))})
        self.assertNotIn("players:thin_body", result["problems"])

    def test_page_dropping_hreflang_the_sitemap_promises(self):
        url = f"{SITE}/blog/a"
        result = self.run_crawl({url: (200, page(url, alts=(("vi", "/vi/blog/a-vi"),)))})
        self.assertIn("blog:hreflang_mismatch", result["problems"])

    def test_hreflang_pointing_outside_the_sitemap(self):
        url = f"{SITE}/blog/a"
        result = self.run_crawl({url: (200, page(url, alts=(("en", "/blog/a"), ("vi", "/vi/blog/ghost"), ("x-default", "/blog/a"))))})
        self.assertIn("blog:hreflang_orphan", result["problems"])

    def test_canonical_poisoning_signature(self):
        """Chữ ký sự cố cũ: nhiều path khác nhau cùng trả một canonical."""
        victim = f"{SITE}/vi/blog/a-vi"
        result = self.run_crawl({victim: (200, page(victim, canonical=f"{SITE}/blog/a"))})
        self.assertIn("poisoning:canonical", result["problems"])
        self.assertIn("blog:canonical_mismatch", result["problems"])

    def test_non_200_for_googlebot(self):
        url = f"{SITE}/blog/a"
        result = self.run_crawl({url: (404, "")})
        self.assertIn("blog:status", result["problems"])

    def test_unreadable_index_raises_instead_of_reporting_health(self):
        with self.assertRaises(RuntimeError):
            seo.crawl_observation(get=lambda url, **kw: (503, ""), day=0)

    def test_duplicate_titles_across_pages_are_reported(self):
        same = {f"{SITE}/blog/a": (200, page(f"{SITE}/blog/a", title="Trùng")),
                f"{SITE}/vi/blog/a-vi": (200, page(f"{SITE}/vi/blog/a-vi", title="Trùng")),
                f"{SITE}/nguoi-choi/x": (200, page(f"{SITE}/nguoi-choi/x", alts=(), words=80, title="Trùng"))}
        self.assertIn("poisoning:title", self.run_crawl(same)["problems"])

    def test_sampling_rotates_and_eventually_covers_everything(self):
        entries = [{"loc": str(i), "alts": {}} for i in range(5)]
        seen = set()
        for day in range(5):
            seen.update(e["loc"] for e in seo.sample(entries, 2, day))
        self.assertEqual(seen, {"0", "1", "2", "3", "4"})


def answer(urls):
    return {"output": [{"type": "message", "content": [
        {"annotations": [{"type": "url_citation", "url": u} for u in urls]}]}]}


class CitationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "citation.json"

    def tearDown(self):
        self.tmp.cleanup()

    def measure(self, per_prompt, prompts=("a", "b")):
        calls = []

        def ask(key, prompt, **kwargs):
            calls.append(prompt)
            return answer(per_prompt(prompt))
        result = seo.citation_observation("key", ask=ask, prompts=list(prompts), cache=self.cache)
        return result, calls

    def test_zero_citations_names_who_is_cited_instead(self):
        result, _ = self.measure(lambda p: ["https://pickna.vn/x", "https://baseline.vn/y"])
        self.assertIn("ai_citation", result["problems"])
        self.assertIn("pickna.vn", result["problems"]["ai_citation"])
        self.assertEqual(result["cited"], 0)

    def test_full_coverage_is_not_a_problem(self):
        result, _ = self.measure(lambda p: ["https://www.thepicklehub.net/blog/a"])
        self.assertEqual(result["problems"], {})
        self.assertEqual(result["cited"], 2)

    def test_partial_coverage_reported_without_rounding_to_zero(self):
        result, _ = self.measure(lambda p: ["https://www.thepicklehub.net/x"] if p == "a" else ["https://pickna.vn/y"],
                                 prompts=("a", "b", "c"))
        self.assertIn("1/3", result["problems"]["ai_citation"])

    def test_weekly_cache_prevents_a_second_paid_run(self):
        self.measure(lambda p: ["https://pickna.vn/x"])
        result, calls = self.measure(lambda p: ["https://pickna.vn/x"])
        self.assertEqual(calls, [])
        self.assertTrue(result["from_cache"])

    def test_stale_cache_is_measured_again(self):
        self.measure(lambda p: ["https://pickna.vn/x"])
        old = json.loads(self.cache.read_text())
        old["measured_at"] = time.time() - 8 * 86400
        self.cache.write_text(json.dumps(old))
        _, calls = self.measure(lambda p: ["https://pickna.vn/x"])
        self.assertEqual(len(calls), 2)

    def test_missing_credential_raises_rather_than_reporting_zero(self):
        with self.assertRaises(RuntimeError):
            seo.citation_observation(None, ask=lambda *a, **k: answer([]))

    def test_own_domain_matched_on_host_not_substring(self):
        result, _ = self.measure(lambda p: ["https://thepicklehub.net.evil.com/x"])
        self.assertEqual(result["cited"], 0)


if __name__ == "__main__":
    unittest.main()


def gsc(clicks_prev=3803, clicks_now=297, losers=(), position_delta=1.9):
    pct = round((clicks_now - clicks_prev) / clicks_prev * 100, 1) if clicks_prev else None
    return {"window": {"current": ["2026-09-12", "2026-09-18"], "previous": ["2026-09-05", "2026-09-11"]},
            "totals": {"current": {"clicks": clicks_now, "impressions": 12835, "position": 8.4},
                       "previous": {"clicks": clicks_prev, "impressions": 46874, "position": 6.5}},
            "wow_pct": {"clicks": pct, "impressions": -72.6, "position_delta": position_delta},
            "pages_losing_clicks": [{"page": p, "clicks_prev": a, "clicks_now": b, "delta": b - a}
                                    for p, a, b in losers]}


# Đúng số liệu 21/09: 94% cú tụt dồn vào 5 trang World Cup Đà Nẵng đã hết giải.
EVENT_DECAY = (("https://www.thepicklehub.net/vi/blog/lich-thi-dau-pwc-2026", 1449, 3),
               ("https://www.thepicklehub.net/blog/pwc-2026-results", 1237, 83),
               ("https://www.thepicklehub.net/vi/blog/ket-qua-pwc-2026", 259, 3),
               ("https://www.thepicklehub.net/blog/pwc-2026-schedule", 223, 6),
               ("https://www.thepicklehub.net/vi/blog/cam-nang-pwc-2026", 216, 0))

SPREAD = tuple((f"https://www.thepicklehub.net/vi/blog/bai-{i}", 120, 30) for i in range(12))


class DeclineTests(unittest.TestCase):
    def healthy(self, url, **kwargs):
        return 200, page(url, alts=())

    def test_event_decay_does_not_open_a_task(self):
        problems, detail = seo.decline_observation(gsc(losers=EVENT_DECAY), get=self.healthy)
        self.assertEqual(problems, {})
        self.assertGreaterEqual(detail["concentration"], 0.9)
        self.assertIn("sự kiện", detail["verdict"])

    def test_same_drop_with_a_broken_page_does(self):
        def get(url, **kwargs):
            if url.endswith("pwc-2026-results"):
                return 404, ""
            return self.healthy(url)
        problems, detail = seo.decline_observation(gsc(losers=EVENT_DECAY), get=get)
        self.assertIn("decline_broken", problems)
        self.assertIn("HTTP 404", problems["decline_broken"])

    def test_page_that_lost_its_body_counts_as_broken(self):
        def get(url, **kwargs):
            if url.endswith("ket-qua-pwc-2026"):
                return 200, page(url, alts=(), words=40)
            return self.healthy(url)
        problems, _ = seo.decline_observation(gsc(losers=EVENT_DECAY), get=get)
        self.assertIn("decline_broken", problems)

    def test_drop_spread_across_the_site_opens_a_task(self):
        problems, detail = seo.decline_observation(gsc(clicks_prev=3803, clicks_now=900, losers=SPREAD), get=self.healthy)
        self.assertIn("decline_sitewide", problems)
        self.assertLess(detail["concentration"], seo.CONCENTRATION)

    def test_small_base_never_alarms(self):
        problems, detail = seo.decline_observation(gsc(clicks_prev=40, clicks_now=2, losers=EVENT_DECAY), get=self.healthy)
        self.assertEqual(problems, {})
        self.assertIn("không kết luận", detail["verdict"])

    def test_missing_report_is_not_read_as_zero_traffic(self):
        problems, detail = seo.decline_observation(None, get=self.healthy)
        self.assertEqual(problems, {})
        self.assertFalse(detail["measured"])

    def test_unreachable_page_is_not_accused(self):
        def get(url, **kwargs):
            raise OSError("network")
        problems, _ = seo.decline_observation(gsc(losers=EVENT_DECAY), get=get)
        self.assertEqual(problems, {})

    def test_stable_traffic_reports_nothing(self):
        problems, detail = seo.decline_observation(gsc(clicks_prev=3803, clicks_now=3700, losers=EVENT_DECAY), get=self.healthy)
        self.assertEqual(problems, {})
        self.assertIn("Không có dấu hiệu", detail["verdict"])


# Máy gửi tin từng phát hiện nằm trong team_verification.py; khi module đó chưa
# có thì phát hiện vẫn vào sổ việc và bản tin 08:00/21:00, chỉ không có tin riêng.
HAS_VERIFICATION = importlib.util.find_spec("team_verification") is not None


@unittest.skipUnless(HAS_VERIFICATION, "team_verification chưa có trong cây mã này")
class TelegramReachTests(unittest.TestCase):
    """Phát hiện của bộ đo SEO phải đi tới Telegram, không chỉ nằm trong sổ."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        from team_store import Store
        self.store = Store(Path(self.tmp.name))

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def observe(self, check, problems, now=None):
        import team_supervisor as team
        import team_verification as verify
        data = {"problems": problems}
        entry = {"ok": True, "measured_at": now or time.time(), "data": data}
        transitions = self.store.findings(check, team.CHECK_ROLES[check], problems, entry)
        verify.reconcile(self.store, check, entry, transitions)
        return entry

    def outbox(self):
        return [r["body"] for r in self.store.db.execute("SELECT body FROM outbox").fetchall()]

    def test_new_crawl_finding_is_queued_to_telegram(self):
        self.observe("crawl", {"blog:thin_body": "https://x/blog/a chỉ có 71 từ"})
        sent = self.outbox()
        self.assertTrue(sent, "phát hiện crawl không vào hàng đợi Telegram")
        self.assertIn("71 từ", "\n".join(sent))

    def test_citation_finding_is_queued_and_closes_when_measured_clean(self):
        self.observe("citation", {"ai_citation": "AI search không dẫn thepicklehub.net ở cả 6 câu"})
        self.assertTrue(self.outbox())
        self.observe("citation", {}, now=time.time() + 60)
        self.assertIn("ĐÃ KIỂM CHỨNG VÀ ĐÓNG", "\n".join(self.outbox()))

    def test_repeated_identical_measurement_does_not_spam(self):
        self.observe("crawl", {"blog:thin_body": "https://x/blog/a chỉ có 71 từ"})
        before = len(self.outbox())
        for i in range(3):
            self.observe("crawl", {"blog:thin_body": "https://x/blog/a chỉ có 71 từ"}, now=time.time() + i)
        self.assertEqual(len(self.outbox()), before)

    def test_growth_decline_finding_reaches_telegram_too(self):
        self.observe("growth", {"decline_broken": "Trang mất click VÀ không còn phục vụ được: https://x (404)"})
        self.assertIn("404", "\n".join(self.outbox()))
