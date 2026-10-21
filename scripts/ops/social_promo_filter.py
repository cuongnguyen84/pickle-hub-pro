"""Last-line product/gear filter for the Chrome posting jobs (FB pages + X).

Owner rule 21/10/2026 (Cuong): no advertorial posts about balls, paddles, shoes,
bags, gear or brand launches, on any channel. The social-poster Worker already
drops these at selection time (workers/social-poster/src/promo-filter.ts, the
source of truth). This mirror runs right before Chrome is driven, so an item
that slips through (an older Worker deploy, a hand-approved x_posts row) is
parked instead of posted. Keep the patterns in sync with promo-filter.ts.
"""
from __future__ import annotations

import re

_I = re.I

PROMO_PATTERNS = [re.compile(p, _I) for p in (
    r"\bpaddle (?:line|lineup|series|release|launch|drop)\b",
    r"\b(?:unveils?|releases?|launches?|expands?|introduces?|debuts?) [^.]{0,30}\b(?:paddle|shoe|apparel|bag|gear|collection)\b",
    r"\bgear (?:review|guide|drop|roundup)\b",
    r"\bbest \d+ [a-z ]*(?:paddles?|shoes?)\b",
    r"\b(?:hands[- ]on|first look) (?:review|with)\b",
    r"\bsponsored\b",
    r"\bpresented by\b",
    r"\bpartners? with\b",
    r"\bannounces? (?:a )?(?:partnership|sponsorship|collaboration)\b",
    r"\bto promote [^.]{0,30}\bbrand\b",
    r"\bbrand (?:tour|activation|ambassador program)\b",
    r"\bnow available\b",
    r"\btickets? (?:are )?on sale\b",
    r"\b(?:use )?(?:promo|discount) code\b",
    r"\b\d+% off\b",
    r"\bgiveaway\b",
    r"\bpre-?order\b",
    r"(?:ra mắt|trình làng|giới thiệu|lấn sân)[^.]{0,40}(?:vợt|giày|balo|túi|bộ sưu tập|sản phẩm|dòng sản phẩm|thời trang)",
    r"bộ sưu tập", r"tài trợ", r"khuyến mãi", r"giảm giá", r"mã giảm", r"mở bán",
    r"đặt (?:trước|hàng)", r"quà tặng", r"trúng thưởng", r"ưu đãi",
)]

GEAR_TITLE_PATTERNS = [re.compile(p, _I) for p in (
    r"\b(?:paddles?|balls?|shoes?|apparel|bags?)\b[^.]{0,40}\b(?:review|buying|launch(?:es|ed)?|debuts?|warranty|technology|tech|testing|popularity|performance)\b",
    r"\b(?:reviews?|best|top|buying|buy|choose|choosing|new)\b[^.]{0,30}\b(?:paddles?|shoes?)\b",
    r"\bpaddle (?:review|buying|guide|line|lineup|series|release|launch|drop|tech(?:nology)?)\b",
    r"\b(?:dead|worn[- ]out) paddle|\bpaddle is dead\b",
    r"\bwarrant(?:y|ies)\b",
    r"\b(?:fake|counterfeit|knock-?off)\b[^.]{0,25}\b(?:balls?|paddles?|shoes?)\b",
    r"(?:đánh giá|review)[^.]{0,30}(?:vợt|bóng|giày|balo|túi)",
    r"(?:vợt|giày|balo|túi|bóng pickleball)[^.]{0,40}đánh giá",
    r"(?:chọn|mua)[^.]{0,15}vợt",
    r"(?:vợt|bóng|giày)[^.]{0,30}(?:tốt nhất|hàng đầu|cao cấp)",
    r"top (?:\d+ )?(?:vợt|giày|bóng)",
    r"bảo hành",
    r"công nghệ vợt",
    r"(?:dòng|mẫu) vợt",
    r"vợt[^.]{0,25}(?:hỏng|chết)",
    r"(?:giả mạo|hàng giả|hàng nhái)",
    r"(?:xuất hiện trên|in lên) (?:mẫu )?vợt",
    r"(?:ra mắt|trình làng)[^.]{0,40}(?:dụng cụ|bóng pickleball|mẫu bóng)",
)]

GEAR_BRANDS = (
    "selkirk", "joola", "gearbox", "six zero", "crbn", "paddletek", "onix", "vatic",
    "volair", "11six24", "sqairz", "diadem", "prokennex", "babolat", "ronbus",
    "bread & butter", "pb5star", "currex", "holbrook", "skechers", "k-swiss", "body helix",
)
AMBIGUOUS_GEAR_BRANDS = (
    "franklin", "wilson", "head", "engage", "gamma", "proton", "honolulu", "electrum",
    "legacy", "vulcan", "adidas", "asics",
)
PRODUCT_NOUN = re.compile(r"\b(?:paddles?|balls?|shoes?|bags?|apparel|gear)\b|vợt|bóng pickleball|giày|balo", _I)
EVENT_MARKER = re.compile(
    r"\b(?:open|cup|championships?|slam|tour|wins?|won|playoffs?|finals?|league|mlp|ppa|app)\b"
    r"|vô địch|giải|chung kết", _I)


def _has_word(text: str, word: str) -> bool:
    # ASCII boundaries on purpose, same as the TS `hasWord`.
    return re.search(rf"(?:^|[^a-z0-9]){re.escape(word)}(?:$|[^a-z0-9])", text, _I) is not None


def is_gear_promo_title(title: str) -> bool:
    title = title or ""
    if any(p.search(title) for p in GEAR_TITLE_PATTERNS):
        return True
    if not EVENT_MARKER.search(title) and any(_has_word(title, b) for b in GEAR_BRANDS):
        return True
    return bool(PRODUCT_NOUN.search(title)) and any(_has_word(title, b) for b in AMBIGUOUS_GEAR_BRANDS)


def is_promotional(title: str, summary: str | None = None) -> bool:
    """True when the item is a product/gear/brand advert rather than news."""
    if is_gear_promo_title(title or ""):
        return True
    text = f"{title or ''} {summary or ''}"
    return any(p.search(text) for p in PROMO_PATTERNS)


SKIP_REASON = "promo_filter: owner rule 21/10/2026, no product/gear/brand posts"
