"""Báo cáo yêu cầu chưa đáp ứng từ chat tạo giải — dữ liệu dựng sẵn, không chạm mạng."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import chat_requests_agent as agent

ROWS = [
    {"user_id": "a", "pending": "series", "user_text": "nhất vào A, nhì vào B, ba vào C", "has_attachment": False,
     "reply": "Đã đặt 3 nhánh.", "intent": "fill", "unmet": "Muốn nhất vào A, nhì vào B, ba vào C"},
    {"user_id": "b", "pending": "count", "user_text": "chơi loại kép được không", "has_attachment": False,
     "reply": "Chat này chỉ tạo giải chia bảng.", "intent": "unsupported", "unmet": None},
    {"user_id": "a", "pending": "name", "user_text": "Giải CLB", "has_attachment": False,
     "reply": "", "intent": "fill", "unmet": None},
]


class Render(unittest.TestCase):
    def test_without_reasoning_lists_flagged_turns(self):
        ids = agent.anon_ids(ROWS)
        text = agent.render(ROWS, ids, None, 24)
        self.assertIn("3 lượt chat · 2 người · AI tự đánh dấu 2", text)
        self.assertIn("U1: Muốn nhất vào A, nhì vào B, ba vào C", text)
        self.assertIn("U2: [unsupported] chơi loại kép được không", text)
        self.assertNotIn("Giải CLB", text)

    def test_reasoned_requests_are_ranked_with_examples(self):
        ideas = {"headline_vi": "2 yêu cầu thể thức", "requests": [
            {"title_vi": "Chia nhánh theo hạng", "users": 1, "examples": ["nhất vào A"], "kind": "the_thuc",
             "suggestion_vi": "Thêm thể thức nhánh theo hạng", "priority": "cao"}]}
        text = agent.render(ROWS, agent.anon_ids(ROWS), ideas, 24)
        self.assertIn("🔴 *1. Chia nhánh theo hạng* — 1 người", text)
        self.assertIn("“nhất vào A”", text)
        self.assertIn("→ Thêm thể thức nhánh theo hạng", text)


if __name__ == "__main__":
    unittest.main()
