"""Reviewed one-article update. Preview by default; explicit --apply uses CAS.

No generated commands or arbitrary table/path parameters. This is not an
autonomous news publisher: a new factual revision requires editorial review.
"""
import argparse
import json
from datetime import datetime, timezone
from urllib.parse import quote
import urllib.request

import team_supervisor as team

ARTICLE_ID = "870d0383-9c23-4dec-ae73-eb624b525418"
SLUG = "ket-qua-kuala-lumpur-cup-2026"
REVISION = "ppa-kl-2026-09-12-reviewed-v1"
MARKER = f"<!-- {REVISION} -->"
SOURCE = "https://www.ppatour-asia.com/double-trouble-on-championship-sunday/"
UPDATE = '''<h2>Cập nhật sau bán kết 12/9: năm cặp chung kết đã xác định</h2>
<p>Bổ sung ngày 13/9/2026, theo bản tin PPA Tour Asia công bố ngày 12/9. Đây là kết quả sau bán kết, chưa phải kết quả chung kết.</p>
<ul>
<li>Đơn nam: Noe Khlif gặp Tama Shimabukuro. Ở bán kết, Khlif thắng Harrison Brown 11–7, 11–0; Shimabukuro thắng Hong Kit Wong 11–7, 11–8.</li>
<li>Đơn nữ: Kaitlyn Christian gặp Brooke Buckner.</li>
<li>Đôi nam: Noe Khlif / Gabriel Tardio gặp Augustus Ge / Len Yang.</li>
<li>Đôi nữ: Jessie Irvine / Alix Truong gặp Danni-Elle Townsend / Sahra Dennehy.</li>
<li>Đôi nam nữ: Jessie Irvine / Gabriel Tardio gặp Danni-Elle Townsend / Joey Wild.</li>
</ul>
<p>Nguồn: <a href="https://www.ppatour-asia.com/double-trouble-on-championship-sunday/">PPA Tour Asia — bản tin sau bán kết 12/9</a>. Xem <a href="/live/pro/ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026">bảng đấu trên ThePickleHub</a> để đối chiếu tỷ số đã ghi nhận. Chưa xác minh kết quả chung kết trong bản cập nhật này.</p>
<h2>Diễn biến trước đó — bản ghi ngày 10/9</h2>
<p>Phần bên dưới được giữ làm lịch sử; các mô tả “chưa thi đấu”, dự đoán nhánh đấu và tình trạng trang nguồn chỉ phản ánh thời điểm 10/9, không phải trạng thái hiện tại.</p>
'''


def prepare(row):
    if row.get("id") != ARTICLE_ID or row.get("slug") != SLUG or row.get("status") != "published":
        raise ValueError("article_scope_mismatch")
    if MARKER in row["content_html"]:
        return None
    faq = [dict(item) for item in row.get("faq_items") or []]
    for item in faq:
        if item.get("question", "").startswith("Ai vô địch"):
            item["answer"] = "Bản cập nhật này mới xác minh kết quả sau bán kết từ bản tin PPA Tour Asia ngày 12/9; chưa xác minh danh sách nhà vô địch. Không dùng trạng thái của bản ghi ngày 10/9 để kết luận chung kết đã hoặc chưa kết thúc."
    return {"content_html": MARKER + "\n" + UPDATE + row["content_html"], "faq_items": faq,
            "meta_description": "Kuala Lumpur Cup 2026: cập nhật sau bán kết 12/9, năm cặp chung kết Pro và tỷ số bán kết đơn nam theo PPA Tour Asia.",
            "excerpt": "Đã bổ sung năm cặp chung kết Pro sau bán kết 12/9 theo PPA Tour Asia. Kết quả vô địch chưa được xác minh trong bản cập nhật này."}


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--apply", action="store_true")
    apply = args.parse_args().apply
    store = team.Store(team.ROOT)
    rows = team.rest(f"vi_blog_posts?id=eq.{ARTICLE_ID}&select=*")
    if len(rows) != 1:
        raise RuntimeError("article_not_unique")
    row = rows[0]
    patch = prepare(row)
    if patch is None:
        print(json.dumps({"status": "already_applied", "revision": REVISION}))
        return
    backup = store.artifact(f"T47-before-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json", json.dumps(row, ensure_ascii=False))
    preview = store.artifact("T47-preview.html", patch["content_html"])
    result = {"status": "preview", "backup": backup, "preview": preview, "source": SOURCE}
    if apply:
        key = team.secret("SUPABASE_SERVICE_ROLE_KEY")
        # Exact target + optimistic lock; never overwrite a concurrent edit.
        path = f"vi_blog_posts?id=eq.{ARTICLE_ID}&slug=eq.{SLUG}&status=eq.published&updated_at=eq.{quote(row['updated_at'], safe='')}"
        req = urllib.request.Request(team.BASE + path, method="PATCH", data=json.dumps(patch).encode(),
              headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"})
        with urllib.request.urlopen(req, timeout=30) as response:
            changed = json.loads(response.read())
        if len(changed) != 1 or MARKER not in changed[0]["content_html"]:
            raise RuntimeError("concurrent_edit_or_write_not_verified")
        result["status"] = "published_reviewed_update"
        result["updated_at"] = changed[0]["updated_at"]
    store.artifact("T47-update-result.json", json.dumps(result, ensure_ascii=False))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
