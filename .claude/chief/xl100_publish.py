#!/usr/bin/env python3
"""Đăng bài XL-100 (đội tuyển VN trước giờ G World Cup 2026) đã được Cuong duyệt.

Chạy: python3 .claude/chief/xl100_publish.py
Sau khi chạy: verify bằng
  curl -A "Googlebot" "https://www.thepicklehub.net/vi/blog/doi-tuyen-pickleball-viet-nam-world-cup-2026?nocache=1"
rồi vào GSC request indexing + IndexNow.
"""
import importlib.util, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("xd", ROOT / "scripts/ops/xuly_daemon.py")
xd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xd)

payload = json.loads((pathlib.Path(__file__).parent / "xl100-post.json").read_text(encoding="utf-8"))
existing = xd.rest(f"vi_blog_posts?select=id&slug=eq.{payload['slug']}")
if existing:
    print("Đã có row, bỏ qua INSERT:", existing[0]["id"])
else:
    r = xd.rest("vi_blog_posts", method="POST", payload=payload)
    print("INSERTED:", r[0]["id"], r[0]["slug"])
print(f"URL: https://www.thepicklehub.net/vi/blog/{payload['slug']}")
