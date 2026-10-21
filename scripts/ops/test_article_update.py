import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import team_article_update as article

class ArticleUpdateTests(unittest.TestCase):
    def test_scope_and_idempotency(self):
        row = {"id": article.ARTICLE_ID, "slug": article.SLUG, "status": "published", "content_html": "old", "faq_items": []}
        result = article.prepare(row)
        self.assertTrue(result['content_html'].endswith('old'))
        self.assertIsNone(article.prepare({**row, 'content_html': result['content_html']}))
        with self.assertRaises(ValueError):
            article.prepare({**row, 'id': 'other'})

    def test_no_premature_champion_claim(self):
        row = {"id": article.ARTICLE_ID, "slug": article.SLUG, "status": "published", "content_html": "old", "faq_items": [{"question": "Ai vô địch Leapmotor?", "answer": "stale"}]}
        self.assertIn('chưa xác minh', article.prepare(row)['faq_items'][0]['answer'])

if __name__ == '__main__':
    unittest.main()
